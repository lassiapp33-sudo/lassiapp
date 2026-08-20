// ============================================================
// EDGE FUNCTION : verify-payment
// Vérifie qu'un paiement est confirmé.
// Si OM 'initiated' → interroge l'API OM directement (pull).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isUUID } from '../_shared/validation.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { sendPushToUser } from '../_shared/push.ts';

const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? '';
const WAVE_PROXY_URL   = Deno.env.get('WAVE_PROXY_URL')   ?? '';
const IS_WAVE_READY    = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
const IS_OM_READY      = isOmReady();
const IS_PRODUCTION    = IS_WAVE_READY || IS_OM_READY;
const IS_OM_SANDBOX    = OM_BASE_URL.includes('sandbox');

// Statuts OM considérés comme succès (API v1 et v4)
const OM_SUCCESS_STATUSES = [
  'SUCCESS', 'SUCCESSFUL', 'success', 'successful',
  'PAYMENT_SUCCESS', 'COMPLETED', 'completed',
];

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token!);
    if (error || !user) return new Response(JSON.stringify({ success: false, error: 'Non autorisé' }), { status: 401 });

    const { paymentIntentId } = await req.json();
    if (!isUUID(paymentIntentId)) {
      return new Response(JSON.stringify({ success: false, error: 'paymentIntentId invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: pi } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .eq('client_id', user.id)
      .single();

    if (!pi) return new Response(JSON.stringify({ success: false, error: 'Introuvable' }), { status: 404 });

    const confirmedStatuses = IS_PRODUCTION
      ? ['confirmed', 'split_done', 'simulated']
      : ['confirmed', 'split_done', 'simulated', 'initiated'];
    let confirmed = confirmedStatuses.includes(pi.statut);

    // ── Pull OM : si 'initiated' + Orange Money configuré → interroger l'API OM ──
    // Évite de dépendre du webhook OM qui peut ne pas arriver.
    if (!confirmed && pi.statut === 'initiated' && pi.moyen_paiement === 'orange_money' && IS_OM_READY) {
      try {
        const omConfirmed = await checkOmPaymentStatus(pi.external_ref, pi.montant_total);
        console.log('[verify-payment] OM pull check:', { external_ref: pi.external_ref, omConfirmed });

        if (omConfirmed) {
          // Paiement confirmé côté OM → confirmer dans notre DB
          await supabase.from('payment_intents').update({
            statut:          'confirmed',
            external_status: 'SUCCESS_PULL',
            confirmed_at:    new Date().toISOString(),
            updated_at:      new Date().toISOString(),
          }).eq('id', paymentIntentId).eq('statut', 'initiated');

          const { data: confirmResult } = await supabase.rpc('confirm_order_from_payment', {
            p_payment_intent_id: paymentIntentId,
          });

          await supabase.from('payment_logs').insert({
            payment_intent_id: paymentIntentId,
            event_type: 'confirmed_via_pull',
            event_data: { source: 'om_api_pull', external_ref: pi.external_ref },
          });

          // Notifier le prestataire
          if (confirmResult?.order_id) {
            try {
              const { data: orderRow } = await supabase
                .from('orders')
                .select('shop_id, client_name, total')
                .eq('id', confirmResult.order_id)
                .maybeSingle();

              if (orderRow?.shop_id) {
                const { data: shopRow } = await supabase
                  .from('shops').select('merchant_id').eq('id', orderRow.shop_id).maybeSingle();

                if (shopRow?.merchant_id) {
                  const montantFr = `${Number(orderRow.total).toLocaleString('fr-FR')} FCFA`;
                  await sendPushToUser(supabase, shopRow.merchant_id, {
                    title:     'Paiement confirmé',
                    body:      `Paiement reçu — Commande de ${orderRow.client_name ?? 'Client'} · ${montantFr}`,
                    data:      { type: 'commande', orderId: confirmResult.order_id },
                    channelId: 'commandes',
                  });
                }
              }
            } catch { /* best-effort */ }
          }

          confirmed = true;
        }
      } catch (omErr) {
        // best-effort : si l'API OM est inaccessible, on continue avec le statut DB
        console.warn('[verify-payment] OM pull check échoué:', omErr instanceof Error ? omErr.message : omErr);
      }
    }

    // Simulation : confirmer côté serveur (aucun webhook ne viendra)
    if (confirmed && pi.statut === 'simulated') {
      await supabase.rpc('confirm_order_from_payment', { p_payment_intent_id: paymentIntentId });
    }

    const resolvedMode = pi.statut === 'simulated'
      ? 'simulation'
      : pi.statut === 'initiated' && IS_OM_SANDBOX
        ? 'sandbox-om'
        : 'production';

    await supabase.from('payment_logs').insert({
      payment_intent_id: paymentIntentId,
      event_type: 'verify_check',
      event_data: { statut: pi.statut, confirmed, mode: resolvedMode },
    });

    return new Response(JSON.stringify({
      success:      true,
      confirmed,
      statut:       confirmed ? 'split_done' : pi.statut,
      montantTotal: pi.montant_total,
      commission:   pi.commission_lassi,
      prixBase:     pi.prix_base,
      mode:         resolvedMode,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Vérifie le statut d'un paiement OM directement via l'API ─────────────────
async function checkOmPaymentStatus(
  externalRef: string | null,
  expectedAmount: number | null,
): Promise<boolean> {
  if (!externalRef) return false;

  const omToken = await getOmToken();
  const headers = {
    'Authorization': `Bearer ${omToken}`,
    'Content-Type': 'application/json',
  };

  // Tenter tous les endpoints OM connus avec l'external_ref stocké (orderId OM ou notre piId fallback)
  const endpoints = [
    `${OM_BASE_URL}/api/eWallet/v4/qrcode/${encodeURIComponent(externalRef)}/status`,
    `${OM_BASE_URL}/api/eWallet/v1/transactions/${encodeURIComponent(externalRef)}/status`,
    `${OM_BASE_URL}/api/eWallet/v1/transactions/${encodeURIComponent(externalRef)}`,
    `${OM_BASE_URL}/api/eWallet/v4/qrcode/${encodeURIComponent(externalRef)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json() as Record<string, unknown>;
      const status = (data.status ?? data.transactionStatus ?? data.paymentStatus) as string | undefined;

      console.log('[checkOmPaymentStatus] endpoint:', url, 'status:', status);

      if (!status) continue;

      const isSuccess = OM_SUCCESS_STATUSES.includes(status);
      if (!isSuccess) return false;

      // Vérification du montant si disponible (sécurité)
      if (expectedAmount !== null) {
        const rawAmt = (data.amount as Record<string, unknown> | undefined)?.value ?? data.amount;
        const receivedAmt = rawAmt !== undefined ? Math.round(Number(rawAmt)) : null;
        if (receivedAmt !== null && Math.abs(receivedAmt - expectedAmount) > 5) {
          console.warn('[checkOmPaymentStatus] montant incohérent:', { expected: expectedAmount, received: receivedAmt });
          return false; // dispute potentielle → ne pas confirmer
        }
      }

      return true;
    } catch {
      continue;
    }
  }

  return false;
}
