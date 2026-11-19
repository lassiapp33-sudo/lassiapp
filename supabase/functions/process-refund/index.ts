// process-refund — Remboursement prestataire en 2 temps (Wave)
//
// POST /functions/v1/process-refund  Body: { order_id }
// → crée une Wave Checkout où la PRESTATAIRE paie LASSI le montant net perçu,
//   renvoie { wave_url, refund_id }. Le reversement au client est fait ensuite
//   par finalize-refund (après confirmation du paiement par la prestataire).
//
// GET  /functions/v1/process-refund?order_id=…  → infos pour le modal.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callWaveCheckout } from '../_shared/waveProxy.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const PHONE_RE = /^7[015678][0-9]{7}$/;
// Wave EXIGE https:// — les URLs de retour passent par lassi.tech (deep link derrière)
const LASSI_PAY_BASE = 'https://lassi.tech/paiement';

// Extrait un numéro sénégalais depuis la note de commande (commandes web invité : « 📞 7XXXXXXXX »)
function phoneFromNote(note: string | null | undefined): string {
  if (!note) return '';
  const m = note.match(/7[015678][0-9]{7}/);
  return m ? m[0] : '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // — Auth JWT → uid du prestataire
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  // — GET : retourne les infos de remboursement sans traiter
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');
    if (!orderId) return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: CORS });

    const { data: order } = await supabase
      .from('orders').select('id, status, pay_method, total, client_id, client_phone, shop_id, note')
      .eq('id', orderId).maybeSingle();
    if (!order) return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: CORS });

    // Vérification légère : prestataire = owner du shop OU client de la commande
    if (order.shop_id) {
      const { data: shop } = await supabase.from('shops').select('merchant_id').eq('id', order.shop_id).maybeSingle();
      if (shop && shop.merchant_id !== user.id && order.client_id !== user.id) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
      }
    }

    const { data: pi } = await supabase.from('payment_intents').select('id, commission_lassi').eq('order_id', orderId).maybeSingle();
    const commissionLassi: number = pi?.commission_lassi ?? Math.round(order.total * 0.01);

    let clientPhone: string = order.client_phone ?? '';
    if (!clientPhone && order.client_id) {
      const { data: profile } = await supabase.from('profiles').select('phone').eq('id', order.client_id).maybeSingle();
      clientPhone = profile?.phone ?? '';
    }
    if (clientPhone) clientPhone = clientPhone.replace(/^\+?221/, '').trim();
    if (!PHONE_RE.test(clientPhone)) clientPhone = phoneFromNote(order.note);

    let montantPrestataire: number = order.total - commissionLassi;
    if (pi?.id) {
      const { data: pq } = await supabase.from('payout_queue').select('montant').eq('payment_intent_id', pi.id).maybeSingle();
      if (pq?.montant) montantPrestataire = pq.montant;
    }

    return new Response(JSON.stringify({
      montant_prestataire: montantPrestataire,
      commission_lassi:    commissionLassi,
      client_phone:        clientPhone,
      pay_method:          order.pay_method,
      already_refunded:    order.status === 'refunded',
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let body: { order_id?: string };
  try { body = await req.json(); } catch { body = {}; }

  const orderId = body.order_id;
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: CORS });
  }

  // — Récupère la commande
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, pay_method, total, client_id, client_phone, shop_id, note')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: CORS });
  }

  // — Vérifie que le prestataire est bien le propriétaire de la commande
  const { data: shop } = await supabase
    .from('shops')
    .select('merchant_id')
    .eq('id', order.shop_id)
    .maybeSingle();

  if (!shop || shop.merchant_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  // Commande terminée = déjà reversée au prestataire → remboursement auto impossible
  if (['done', 'refused', 'refunded'].includes(order.status)) {
    return new Response(JSON.stringify({ error: 'order_not_refundable' }), { status: 400, headers: CORS });
  }
  if (order.pay_method !== 'wave') {
    // OM : flux 2-temps non encore implémenté (checkout marchand OM différent).
    return new Response(JSON.stringify({ error: 'om_refund_unsupported' }), { status: 400, headers: CORS });
  }

  // — payment_intent + montant NET perçu par le prestataire (= ce qu'elle rembourse)
  const { data: pi } = await supabase
    .from('payment_intents')
    .select('id, commission_lassi, montant_total')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!pi) {
    return new Response(JSON.stringify({ error: 'payment_intent_not_found' }), { status: 400, headers: CORS });
  }

  // Net reçu = montant du payout_queue (ce qui a été viré au prestataire)
  let net = 0;
  if (pi.id) {
    const { data: pq } = await supabase
      .from('payout_queue').select('montant').eq('payment_intent_id', pi.id).maybeSingle();
    net = pq?.montant ?? 0;
  }
  if (net <= 0) net = (pi.montant_total ?? order.total) - (pi.commission_lassi ?? 0);
  if (net <= 0) {
    return new Response(JSON.stringify({ error: 'montant_invalide' }), { status: 400, headers: CORS });
  }

  // — Numéro client (pour le reversement final par LASSI)
  let clientPhone: string | null = order.client_phone ?? null;
  if (!clientPhone && order.client_id) {
    const { data: profile } = await supabase
      .from('profiles').select('phone').eq('id', order.client_id).maybeSingle();
    clientPhone = profile?.phone ?? null;
  }
  if (clientPhone) clientPhone = clientPhone.replace(/^\+?221/, '').trim();
  if (!clientPhone || !PHONE_RE.test(clientPhone)) {
    const fromNote = phoneFromNote(order.note);
    if (fromNote) clientPhone = fromNote;
  }
  if (!clientPhone || !PHONE_RE.test(clientPhone)) {
    return new Response(JSON.stringify({ error: 'client_phone_invalid' }), { status: 400, headers: CORS });
  }

  // — Réutilise un remboursement en cours pour cette commande (évite les doublons)
  const { data: existing } = await supabase
    .from('merchant_refunds')
    .select('id, status, checkout_id')
    .eq('order_id', orderId)
    .in('status', ['awaiting_payment', 'merchant_paid'])
    .maybeSingle();

  const refundRowId = existing?.id ?? crypto.randomUUID();

  // — Crée la session Wave Checkout : la prestataire paie LASSI le montant net
  let waveUrl: string;
  let checkoutId: string;
  try {
    const r = await createMerchantCheckout({ reference: refundRowId, amount: net });
    waveUrl = r.launchUrl;
    checkoutId = r.checkoutId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'wave_checkout_failed';
    console.error('[process-refund] checkout error:', msg);
    return new Response(JSON.stringify({ error: 'wave_checkout_failed', detail: msg }), { status: 500, headers: CORS });
  }

  if (existing?.id) {
    await supabase.from('merchant_refunds')
      .update({ checkout_id: checkoutId, amount: net, client_phone: clientPhone, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('merchant_refunds').insert({
      id: refundRowId, order_id: orderId, merchant_id: user.id, client_id: order.client_id,
      client_phone: clientPhone, amount: net, pay_method: 'wave',
      checkout_id: checkoutId, checkout_ref: refundRowId, status: 'awaiting_payment',
    });
  }

  return new Response(
    JSON.stringify({ success: true, wave_url: waveUrl, refund_id: refundRowId, amount: net }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});

// ── Wave Checkout marchand ──────────────────────────────────────────────────────
// Crée une session où la PRESTATAIRE paie LASSI le montant net qu'elle a perçu.
// À la fin (son Wave s'ouvre, elle confirme), finalize-refund reverse au client.
async function createMerchantCheckout(p: { reference: string; amount: number }): Promise<{ launchUrl: string; checkoutId: string }> {
  const waveBody = JSON.stringify({
    amount:           p.amount,
    currency:         'XOF',
    client_reference: p.reference,
    success_url:      `${LASSI_PAY_BASE}/succes?refund=${p.reference}`,
    error_url:        `${LASSI_PAY_BASE}/echec?refund=${p.reference}`,
  });
  const res  = await callWaveCheckout(waveBody, `refund_${p.reference}`);
  const data = await res.json();
  if (!res.ok || !data.wave_launch_url) {
    throw new Error(`Wave checkout: ${data.message ?? data.code ?? JSON.stringify(data)}`);
  }
  return { launchUrl: data.wave_launch_url, checkoutId: data.id };
}
