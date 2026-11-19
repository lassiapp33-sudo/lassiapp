// finalize-refund — 2ᵉ temps du remboursement prestataire (Wave)
//
// POST /functions/v1/finalize-refund  Body: { refund_id }
// Auth: JWT prestataire (authenticated)
//
// 1. Vérifie que la prestataire a bien payé la Wave Checkout (session payée)
// 2. LASSI reverse le montant net au client (Wave payout) — le solde LASSI
//    vient d'être réalimenté par le paiement de la prestataire
// 3. Marque la commande 'refunded' + notifie le client
//
// Idempotent : rejoue sans double paiement grâce à merchant_refunds.status.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { waveRequestPayout, getWaveCheckout } from '../_shared/waveProxy.ts';
import { sendPushToUser } from '../_shared/push.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const SUCCESS_STATUSES = ['succeeded', 'completed', 'success', 'SUCCESSFUL',
  'SUCCEEDED', 'PAID', 'paid', 'payment_successful', 'PAYMENT_SUCCEEDED', 'COMPLETED'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405, headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  let body: { refund_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const refundId = body.refund_id;
  if (!refundId) return new Response(JSON.stringify({ error: 'refund_id required' }), { status: 400, headers: CORS });

  const { data: refund } = await supabase
    .from('merchant_refunds').select('*').eq('id', refundId).maybeSingle();
  if (!refund) return new Response(JSON.stringify({ error: 'refund_not_found' }), { status: 404, headers: CORS });
  if (refund.merchant_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  // Déjà remboursé → idempotent
  if (refund.status === 'client_refunded') {
    return new Response(JSON.stringify({ success: true, already: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 1. Vérifie que la prestataire a payé la session Wave
  if (!refund.checkout_id) {
    return new Response(JSON.stringify({ error: 'no_checkout' }), { status: 400, headers: CORS });
  }
  let paid = false;
  try {
    const r = await getWaveCheckout(refund.checkout_id);
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      const st = String(d.payment_status ?? d.status ?? '');
      paid = SUCCESS_STATUSES.includes(st);
    }
  } catch (e) {
    console.error('[finalize-refund] getWaveCheckout erreur:', e instanceof Error ? e.message : e);
  }
  if (!paid) {
    return new Response(JSON.stringify({ success: false, paid: false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // Verrou : passe à merchant_paid une seule fois
  if (refund.status === 'awaiting_payment') {
    await supabase.from('merchant_refunds')
      .update({ status: 'merchant_paid', updated_at: new Date().toISOString() })
      .eq('id', refundId).eq('status', 'awaiting_payment');
  }

  // Commission LASSI que le client avait payée → LASSI la lui rend aussi.
  // Le client récupère donc la TOTALITÉ : net (payé par la prestataire) + commission (rendue par LASSI).
  const { data: pi } = await supabase
    .from('payment_intents').select('id, commission_lassi').eq('order_id', refund.order_id).maybeSingle();
  const commission = Math.max(0, pi?.commission_lassi ?? 0);
  const montantClient = refund.amount + commission;

  // 2. LASSI reverse la totalité au client via Wave payout
  let payoutRef: string;
  try {
    const payoutBody = JSON.stringify({
      currency:         'XOF',
      receive_amount:   String(montantClient),
      mobile:           `+221${refund.client_phone}`,
      client_reference: `refundpay_${refundId}`,
    });
    const res  = await waveRequestPayout(payoutBody, `refundpay_${refundId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(`Wave ${data.code ?? data.error}: ${data.message ?? JSON.stringify(data)}`);
    if (data.status === 'failed' || data.payout_error) {
      throw new Error(`Wave payout failed: ${data.payout_error?.error_code ?? 'unknown'}`);
    }
    payoutRef = data.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'payout_failed';
    console.error('[finalize-refund] payout client échoué:', msg);
    return new Response(JSON.stringify({ error: 'client_payout_failed', detail: msg }), { status: 500, headers: CORS });
  }

  // 3. Marque remboursé
  await supabase.from('merchant_refunds')
    .update({ status: 'client_refunded', client_payout_ref: payoutRef, updated_at: new Date().toISOString() })
    .eq('id', refundId);

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', refund.order_id);
  if (updErr) console.error('[finalize-refund] maj statut refunded:', updErr.message);

  // Annule tout reste de payout_queue (le prestataire a remboursé)
  if (pi?.id) {
    await supabase.from('payout_queue')
      .update({ statut: 'cancelled', updated_at: new Date().toISOString() })
      .eq('payment_intent_id', pi.id)
      .not('statut', 'in', '("paid","processing")');
  }

  // Notif client
  if (refund.client_id) {
    try {
      await sendPushToUser(supabase, refund.client_id, {
        title: 'Commande remboursée 💸',
        body:  `Tu as été remboursé(e) de ${montantClient} F via Wave.`,
        data:  { type: 'refund', order_id: refund.order_id },
        channelId: 'commandes-v2',
      });
    } catch (e) {
      console.warn('[finalize-refund] push notif échouée (non-bloquant):', e);
    }
  }

  return new Response(
    JSON.stringify({ success: true, payout_ref: payoutRef, montant_rembourse: montantClient }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
