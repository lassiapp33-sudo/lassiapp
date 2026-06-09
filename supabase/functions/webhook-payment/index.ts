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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body   = await req.text();
  const source = req.headers.get('X-Wave-Signature') ? 'wave' : 'orange_money';

  // ============================================================
  // VÉRIFICATION DE SIGNATURE (sécurité bancaire critique)
  // Empêche un attaquant d'envoyer de faux webhooks
  // ============================================================
  const signature = req.headers.get('X-Wave-Signature') ?? req.headers.get('X-OM-Signature') ?? '';
  const secret    = source === 'wave' ? WAVE_WEBHOOK_SECRET : OM_WEBHOOK_SECRET;

  if (secret) {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (signature !== expected && signature !== `sha256=${expected}`) {
      console.error('[webhook] Signature invalide');
      return new Response('Signature invalide', { status: 401 });
    }
  }

  const payload = JSON.parse(body);

  // Extraire l'ID payment_intent et le statut selon Wave ou OM
  const piId           = payload.client_reference ?? payload.order_id ?? payload.metadata?.pi_id;
  const externalStatus = payload.payment_status   ?? payload.status;
  const isSuccess      = ['succeeded', 'completed', 'success', 'SUCCESSFULL'].includes(externalStatus);

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
    event_type:  'webhook',
    event_data:  { source, status: externalStatus, payload },
  });

  // Si paiement confirmé → déclencher la commande
  if (isSuccess && piId) {
    await supabase.rpc('confirm_order_from_payment', { p_payment_intent_id: piId });
  }

  return new Response('OK', { status: 200 });
});
