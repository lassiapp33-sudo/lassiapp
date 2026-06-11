// ============================================================
// EDGE FUNCTION : webhook-payment (payment-webhook)
// Reçoit les confirmations asynchrones de Wave/OM
// 🔌 L'ingénieur Wave/OM configure cette URL dans leur dashboard
// URL : https://[project].supabase.co/functions/v1/webhook-payment
//
// Section 3.2 — point le plus critique :
//   1. Signature HMAC obligatoire (sinon 401, rien n'est fait)
//   2. Le traitement (idempotence, anti-rejeu, vérification du montant,
//      transition + activation commande + payout_queue) est délégué à
//      process_payment_webhook(), une transaction SQL atomique unique :
//      soit tout est appliqué, soit rien (rollback automatique en cas
//      d'erreur, l'argent reste en sécurité).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { isUUID } from '../_shared/validation.ts';
import { logAuditEvent } from '../_shared/audit.ts';

const WAVE_WEBHOOK_SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET') ?? '';
const OM_WEBHOOK_SECRET   = Deno.env.get('OM_WEBHOOK_SECRET')   ?? '';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.text();

  // ── 1. Détermination de la source via les en-têtes de signature ──────────
  // Rejet explicite si aucun en-tête connu → pas de fallback silencieux
  const waveSignature = req.headers.get('X-Wave-Signature');
  const omSignature   = req.headers.get('X-OM-Signature');

  let source: 'wave' | 'orange_money';
  let signature: string;
  let secret: string;

  if (waveSignature) {
    source    = 'wave';
    signature = waveSignature;
    secret    = WAVE_WEBHOOK_SECRET;
  } else if (omSignature) {
    source    = 'orange_money';
    signature = omSignature;
    secret    = OM_WEBHOOK_SECRET;
  } else {
    console.error('[webhook] En-tête de signature absent (X-Wave-Signature ou X-OM-Signature requis)');
    return new Response('Signature manquante', { status: 401 });
  }

  // ── Vérification HMAC (rejet si secret non configuré) ────────────────────
  if (!secret) {
    console.error(`[webhook] Secret ${source} non configuré — WAVE_WEBHOOK_SECRET / OM_WEBHOOK_SECRET requis`);
    return new Response('Configuration manquante', { status: 500 });
  }

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  const sigNorm = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (!timingSafeEqual(expected, sigNorm)) {
    console.error('[webhook] Signature invalide — tentative rejetée');
    await logAuditEvent(supabase, {
      action:      'webhook_invalid_signature',
      targetTable: 'payment_intents',
      metadata:    { source },
    });
    return new Response('Signature invalide', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[webhook] Body non-JSON');
    return new Response('Body invalide', { status: 400 });
  }

  // ── Validation du payment_intent_id (rejet si absent) ─────────────────────
  const piId: unknown = payload.client_reference ?? payload.order_id ?? (payload.metadata as Record<string, unknown> | undefined)?.pi_id;
  if (!isUUID(piId)) {
    console.error('[webhook] payment_intent_id absent ou invalide dans le payload', payload);
    return new Response('payment_intent_id manquant', { status: 400 });
  }

  const externalStatus = (payload.payment_status ?? payload.status) as string | undefined;
  const isSuccess      = ['succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCESSFULL'].includes(externalStatus ?? '');
  const externalRef    = (payload.id ?? payload.transaction_id ?? payload.pay_token ?? payload.notif_token) as string | undefined;

  // 3. ID d'événement pour la déduplication (un même événement Wave/OM peut
  // être renvoyé plusieurs fois). 🔌 À ajuster avec l'ingénieur Wave/OM si un
  // champ "event_id" dédié existe — à défaut, (référence externe + statut)
  // identifie une livraison de webhook de façon stable.
  const externalEventId = `${externalRef ?? piId}:${externalStatus ?? 'unknown'}`;

  // 4. Montant reçu, pour vérification au FCFA près (null si absent du payload)
  const rawAmount = payload.amount ?? payload.client_amount ?? null;
  const receivedAmount = rawAmount !== null && rawAmount !== undefined && Number.isFinite(Number(rawAmount))
    ? Math.round(Number(rawAmount))
    : null;

  // ── Traitement atomique + idempotent (3 à 6) ──────────────────────────────
  const { data: result, error: rpcError } = await supabase.rpc('process_payment_webhook', {
    p_external_event_id: externalEventId,
    p_payment_intent_id: piId,
    p_source:            source,
    p_external_status:   String(externalStatus ?? ''),
    p_external_ref:      externalRef ?? null,
    p_received_amount:   receivedAmount,
    p_is_success:        isSuccess,
    p_raw_payload:       payload,
  });

  if (rpcError) {
    // 8. Échec inattendu : la transaction SQL a été annulée (rollback), rien
    // n'a changé. On répond en erreur pour que Wave/OM réessaie plus tard.
    console.error('[webhook] process_payment_webhook erreur DB:', rpcError.message);
    return new Response('Erreur serveur', { status: 500 });
  }

  if (result?.disputed) {
    console.error('[ALERTE PAIEMENT] montant incohérent — payment_intent', piId, JSON.stringify(result));
  } else if (!result?.ok && result?.error === 'payment_intent_not_found') {
    console.error('[webhook] payment_intent introuvable pour', piId, 'source', source);
  } else if (result?.already_processed) {
    console.log('[webhook] événement déjà traité (idempotence) — pi', piId);
  } else if (result?.ignored) {
    console.log('[webhook] événement ignoré (anti-rejeu) — pi', piId, 'statut', result.statut);
  }

  // ── Section 5 : anti-abus — log si > 100 webhooks/h pour ce payment_intent ──
  // Ne bloque jamais (Wave/OM doit toujours recevoir 200) : simple alerte.
  if (result?.error !== 'payment_intent_not_found') {
    const { data: rl } = await supabase.rpc('check_rate_limit', {
      p_key: `webhook:${piId}`,
      p_max_attempts: 100,
      p_window_seconds: 3600,
      p_block_seconds: 0,
    });
    if (rl?.allowed === false) {
      console.error('[ALERTE ANTI-ABUS] +100 webhooks/h pour payment_intent', piId);
      await supabase.from('payment_logs').insert({
        payment_intent_id: piId,
        event_type: 'webhook_abuse_alert',
        event_data: { source, count: rl.count ?? null, external_event_id: externalEventId },
      });
    }
  }

  // 7. Répondre 200 OK rapidement à Wave/OM dans tous les cas gérés
  // (idempotence, anti-rejeu, échec, dispute, succès) : le retraitement se
  // ferait en double sinon. Seule une vraie erreur serveur (ci-dessus) renvoie 500.
  return new Response('OK', { status: 200 });
});

// Comparaison HMAC en temps constant — évite les timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
