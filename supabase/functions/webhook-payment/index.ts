// ============================================================
// EDGE FUNCTION : webhook-payment
// Reçoit les confirmations asynchrones de Wave/OM
// 🔌 L'ingénieur Wave/OM configure cette URL dans leur dashboard
// URL : https://[project].supabase.co/functions/v1/webhook-payment
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const WAVE_WEBHOOK_SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET') ?? '';
const OM_WEBHOOK_SECRET   = Deno.env.get('OM_WEBHOOK_SECRET')   ?? '';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.text();

  // ── Détermination de la source via les en-têtes de signature ─────────────
  // Fix: rejet explicite si aucun en-tête connu → pas de fallback silencieux
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

  // ── Vérification HMAC (Fix: rejet si secret non configuré) ───────────────
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
    console.error('[webhook] Signature invalide');
    return new Response('Signature invalide', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[webhook] Body non-JSON');
    return new Response('Body invalide', { status: 400 });
  }

  // ── Validation du payment_intent_id (Fix: rejet si absent) ───────────────
  const piId: unknown = payload.client_reference ?? payload.order_id ?? payload.metadata?.pi_id;
  if (!piId || typeof piId !== 'string') {
    console.error('[webhook] payment_intent_id absent ou invalide dans le payload', payload);
    return new Response('payment_intent_id manquant', { status: 400 });
  }

  const externalStatus = payload.payment_status ?? payload.status;
  const isSuccess      = ['succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCESSFULL'].includes(externalStatus);

  // Mettre à jour le payment_intent
  await supabase.from('payment_intents').update({
    external_status: externalStatus,
    external_ref:    payload.id ?? payload.transaction_id ?? payload.pay_token,
    statut:          isSuccess ? 'confirmed' : 'failed',
    confirmed_at:    isSuccess ? new Date().toISOString() : null,
    updated_at:      new Date().toISOString(),
  }).eq('id', piId);

  // Log immuable
  await supabase.from('payment_logs').insert({
    payment_intent_id: piId,
    event_type:        'webhook',
    event_data:        { source, status: externalStatus, payload },
  });

  // Si paiement confirmé → déclencher la commande (Fix: vérifier le retour)
  if (isSuccess) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'confirm_order_from_payment',
      { p_payment_intent_id: piId },
    );
    if (rpcError) {
      console.error('[webhook] confirm_order_from_payment erreur DB:', rpcError.message);
    } else if (rpcResult && !rpcResult.ok) {
      console.error('[webhook] confirm_order_from_payment retour ko:', JSON.stringify(rpcResult));
    }
  }

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
