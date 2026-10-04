// Edge Function — reconcile-wave-payments
// Récupère tous les payment_intents Wave bloqués en INITIATED et vérifie
// leur statut via l'API Wave. Si payé → confirme + déclenche payout.
// Si expiré/annulé → marque failed.
// Appelée par pg_cron toutes les 5 minutes.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWaveCheckout } from '../_shared/waveProxy.ts';
import { buildWaveSignature } from '../_shared/waveSign.ts';

const CRON_SECRET   = Deno.env.get('CRON_SECRET')               ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WAVE_API_KEY  = Deno.env.get('WAVE_API_KEY')              ?? '';

const WAVE_SUCCESS_STATUSES = new Set([
  'succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCEEDED',
  'PAID', 'paid', 'payment_successful', 'PAYMENT_SUCCEEDED', 'COMPLETED',
]);
const WAVE_FAILED_STATUSES = new Set([
  'expired', 'failed', 'cancelled', 'canceled', 'error',
  'EXPIRED', 'FAILED', 'CANCELLED', 'CANCELED', 'ERROR',
]);

// Récupère la session Wave par son ID (external_ref = cos-*)
async function waveGetBySessionId(sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    const sig = await buildWaveSignature('');
    const headers: Record<string, string> = { 'Authorization': `Bearer ${WAVE_API_KEY}` };
    if (sig) headers['Wave-Signature'] = sig;
    const res = await fetch(
      `https://api.wave.com/v1/checkout/sessions/${sessionId}`,
      { headers },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[reconcile] Wave session ${sessionId} → ${res.status} ${errText.slice(0, 120)}`);
      return null;
    }
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    console.error(`[reconcile] Wave session ${sessionId} erreur:`, e instanceof Error ? e.message : e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const cronHeader = req.headers.get('X-Cron-Secret') ?? '';
  if (CRON_SECRET && cronHeader && cronHeader !== CRON_SECRET) {
    return new Response('Non autorisé', { status: 401 });
  }

  // Mode debug : ?debug=1 — teste 1 session Wave et retourne la réponse brute
  const url = new URL(req.url);
  if (url.searchParams.get('debug') === '1') {
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: sample } = await sb
      .from('payment_intents')
      .select('id, external_ref')
      .eq('statut', 'initiated').eq('moyen_paiement', 'wave')
      .not('external_ref', 'is', null)
      .limit(1).single();
    if (!sample) return new Response('Pas de PI initiated', { status: 404 });
    const sessionId = sample.external_ref as string;
    try {
      const sig = await buildWaveSignature('');
      const headers: Record<string,string> = { 'Authorization': `Bearer ${WAVE_API_KEY}` };
      if (sig) headers['Wave-Signature'] = sig;
      const res = await fetch(`https://api.wave.com/v1/checkout/sessions/${sessionId}`, { headers });
      const text = await res.text();
      return new Response(JSON.stringify({ status: res.status, session_id: sessionId, sig_set: !!sig, body: text.slice(0, 600) }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!WAVE_API_KEY) {
    return new Response('WAVE_API_KEY manquant', { status: 503 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

  // Récupérer tous les INITIATED Wave plus vieux que 5 minutes (pas juste créés)
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: rows, error } = await sb
    .from('payment_intents')
    .select('id, external_ref, montant_total, moyen_paiement, order_id')
    .eq('statut', 'initiated')
    .eq('moyen_paiement', 'wave')
    .not('external_ref', 'is', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(50); // max 50 par run pour éviter timeout

  if (error) {
    console.error('[reconcile] select erreur:', error.message);
    return new Response('Erreur DB', { status: 500 });
  }

  const results = { confirmed: 0, failed: 0, pending: 0, errors: 0 };

  for (const row of (rows ?? [])) {
    const piId = row.id as string;
    const sessionId = row.external_ref as string;

    const session = await waveGetBySessionId(sessionId);
    if (!session) { results.errors++; continue; }

    const status = String(session.payment_status ?? session.status ?? '');

    if (WAVE_SUCCESS_STATUSES.has(status)) {
      // Confirmer via process_payment_webhook (même chemin que webhook réel)
      const externalRef = String(session.id ?? session.transaction_id ?? sessionId);
      const rawAmount = session.amount ?? session.client_amount ?? null;
      const receivedAmount = rawAmount !== null && Number.isFinite(Number(rawAmount))
        ? Math.round(Number(rawAmount)) : null;
      const externalEventId = `${externalRef}:${status}:reconcile`;

      const { data: res, error: rpcErr } = await sb.rpc('process_payment_webhook', {
        p_external_event_id: externalEventId,
        p_payment_intent_id: piId,
        p_source:            'wave',
        p_external_status:   status,
        p_external_ref:      externalRef,
        p_received_amount:   receivedAmount,
        p_is_success:        true,
        p_raw_payload:       session,
      });

      if (rpcErr) {
        console.error(`[reconcile] process_payment_webhook erreur pi=${piId}:`, rpcErr.message);
        results.errors++;
      } else if (res?.ok && !res?.already_processed) {
        console.log(`[reconcile] ✅ confirmé pi=${piId} session=${sessionId} montant=${receivedAmount}`);
        results.confirmed++;
        // Déclencher payout immédiatement
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/process-payouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': CRON_SECRET },
            body: '{}',
          });
        } catch { /* best-effort */ }
      } else if (res?.already_processed) {
        results.pending++;
      }

    } else if (WAVE_FAILED_STATUSES.has(status)) {
      // Session expirée ou annulée → marquer failed
      const { error: upErr } = await sb
        .from('payment_intents')
        .update({ statut: 'failed', updated_at: new Date().toISOString() })
        .eq('id', piId)
        .eq('statut', 'initiated');

      if (upErr) {
        console.error(`[reconcile] update failed erreur pi=${piId}:`, upErr.message);
        results.errors++;
      } else {
        // Annuler la commande associée (utiliser order_id déjà récupéré dans le select)
        const orderId = row.order_id as string | null;
        if (orderId) {
          await sb
            .from('orders')
            .update({ status: 'refused', updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .in('status', ['pending', 'new']);
        }
        console.log(`[reconcile] ❌ expiré pi=${piId} status=${status}`);
        results.failed++;
      }

    } else {
      // Statut inconnu ou toujours en cours
      results.pending++;
    }
  }

  console.log('[reconcile] terminé:', JSON.stringify({ ...results, total: (rows ?? []).length }));
  return new Response(JSON.stringify({ ok: true, ...results, total: (rows ?? []).length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
