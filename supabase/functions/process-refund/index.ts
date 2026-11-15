// process-refund — Remboursement manuel prestataire
//
// POST /functions/v1/process-refund
// Body: { order_id: string }
// Auth: JWT du prestataire (authenticated)
//
// Flux :
//   1. Vérifie que la commande appartient au prestataire courant
//   2. Vérifie statut 'done' + moyen paiement wave/om
//   3. Récupère commission_lassi depuis payment_intents
//   4. Envoie la commission_lassi au client via Wave/OM payout
//   5. Marque l'ordre 'refunded' + insère notification client

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { waveRequestPayout } from '../_shared/waveProxy.ts';
import { sendPushToUser } from '../_shared/push.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';
const PHONE_RE = /^7[015678][0-9]{7}$/;

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
      .from('orders').select('id, status, pay_method, total, client_id, client_phone, shop_id')
      .eq('id', orderId).maybeSingle();
    if (!order) return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: CORS });

    // Vérification légère : prestataire = owner du shop OU client de la commande
    if (order.shop_id) {
      const { data: shop } = await supabase.from('shops').select('owner_id').eq('id', order.shop_id).maybeSingle();
      if (shop && shop.owner_id !== user.id && order.client_id !== user.id) {
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
    .select('id, status, pay_method, total, client_id, client_phone, shop_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: CORS });
  }

  // — Vérifie que le prestataire est bien le propriétaire de la commande
  const { data: shop } = await supabase
    .from('shops')
    .select('owner_id')
    .eq('id', order.shop_id)
    .maybeSingle();

  if (!shop || shop.owner_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  if (['refused', 'refunded'].includes(order.status)) {
    return new Response(JSON.stringify({ error: 'order_not_refundable' }), { status: 400, headers: CORS });
  }
  if (!['wave', 'om'].includes(order.pay_method)) {
    return new Response(JSON.stringify({ error: 'cash_not_refundable' }), { status: 400, headers: CORS });
  }

  // — payment_intent lié à cet order
  const { data: pi } = await supabase
    .from('payment_intents')
    .select('id, commission_lassi, moyen_paiement')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!pi) {
    return new Response(JSON.stringify({ error: 'payment_intent_not_found' }), { status: 400, headers: CORS });
  }

  const commissionLassi: number = pi.commission_lassi ?? Math.round(order.total * 0.01);

  // — Numéro de téléphone du client
  let clientPhone: string | null = order.client_phone ?? null;
  if (!clientPhone && order.client_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', order.client_id)
      .maybeSingle();
    clientPhone = profile?.phone ?? null;
  }

  // Nettoie le numéro (retire +221 ou 221)
  if (clientPhone) clientPhone = clientPhone.replace(/^\+?221/, '').trim();

  if (!clientPhone || !PHONE_RE.test(clientPhone)) {
    return new Response(JSON.stringify({ error: 'client_phone_invalid' }), { status: 400, headers: CORS });
  }

  // — Montant total à rembourser au client (LASSI avance tout)
  const montantRemboursement = order.total;

  if (montantRemboursement <= 0) {
    await supabase
      .from('orders')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', orderId);
    return new Response(JSON.stringify({ success: true, payout_ref: null }), { headers: CORS });
  }

  // — Annule le payout_queue du prestataire (LASSI rembourse le client directement)
  if (pi.id) {
    await supabase
      .from('payout_queue')
      .update({ statut: 'cancelled', updated_at: new Date().toISOString() })
      .eq('payment_intent_id', pi.id)
      .not('statut', 'in', '("paid","processing")');
  }

  // — Envoie le remboursement complet au client via Wave/OM payout
  const refundId = `refund_${orderId}`;
  let payoutRef: string;

  try {
    if (order.pay_method === 'wave') {
      payoutRef = await sendWaveRefund({ refundId, montant: montantRemboursement, phone: clientPhone });
    } else {
      payoutRef = await sendOmRefund({ refundId, montant: montantRemboursement, phone: clientPhone });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur payout';
    console.error('[process-refund] payout error:', msg);
    // Restaure le payout_queue si le payout échoue
    if (pi.id) {
      await supabase
        .from('payout_queue')
        .update({ statut: 'queued', updated_at: new Date().toISOString() })
        .eq('payment_intent_id', pi.id)
        .eq('statut', 'cancelled');
    }
    return new Response(JSON.stringify({ error: 'payout_failed', detail: msg }), { status: 500, headers: CORS });
  }

  // — Marque la commande remboursée
  await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', orderId);

  // — Notification client
  if (order.client_id) {
    try {
      const methodLabel = order.pay_method === 'wave' ? 'Wave' : 'Orange Money';
      await sendPushToUser(supabase, order.client_id, {
        title: 'Commande remboursée 💸',
        body:  `Ta commande a été remboursée. ${montantRemboursement} F virés par LASSI via ${methodLabel}.`,
        data:  { type: 'refund', order_id: orderId },
      });
    } catch (e) {
      console.warn('[process-refund] push notif failed (non-bloquant):', e);
    }
  }

  return new Response(
    JSON.stringify({ success: true, payout_ref: payoutRef, montant_rembourse: montantRemboursement }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});

// ── Wave refund ────────────────────────────────────────────────────────────────
async function sendWaveRefund(p: { refundId: string; montant: number; phone: string }): Promise<string> {
  const body = JSON.stringify({
    currency:         'XOF',
    receive_amount:   String(p.montant),
    mobile:           `+221${p.phone}`,
    client_reference: p.refundId,
  });
  const res = await waveRequestPayout(body, p.refundId);
  const data = await res.json();
  if (!res.ok) throw new Error(`Wave ${data.code ?? data.error}: ${data.message ?? JSON.stringify(data)}`);
  if (data.status === 'failed' || data.payout_error) {
    throw new Error(`Wave payout failed: ${data.payout_error?.error_code ?? 'unknown'}`);
  }
  return data.id;
}

// ── Orange Money refund ────────────────────────────────────────────────────────
async function sendOmRefund(p: { refundId: string; montant: number; phone: string }): Promise<string> {
  const { getOmToken, OM_BASE_URL } = await import('../_shared/omAuth.ts');
  const omToken = await getOmToken();
  const res = await fetch(`${OM_BASE_URL}/api/eWallet/v1/cashins`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${omToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner: {
        idType: 'MSISDN', id: OM_RETAILER_MSISDN, encryptedPinCode: OM_RETAILER_PIN_ENCRYPTED,
      },
      customer: { idType: 'MSISDN', id: p.phone },
      amount:   { value: p.montant, unit: 'XOF' },
      reference: p.refundId,
      receiveNotification: false,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OM refund error (${res.status}): ${err.detail ?? JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.transactionId ?? data.requestId ?? p.refundId;
}
