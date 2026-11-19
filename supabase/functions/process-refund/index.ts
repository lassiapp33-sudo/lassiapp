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
import { waveRequestRefund } from '../_shared/waveProxy.ts';
import { sendPushToUser } from '../_shared/push.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';
const PHONE_RE = /^7[015678][0-9]{7}$/;

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
  if (!['wave', 'om'].includes(order.pay_method)) {
    return new Response(JSON.stringify({ error: 'cash_not_refundable' }), { status: 400, headers: CORS });
  }

  // — payment_intent lié à cet order
  const { data: pi } = await supabase
    .from('payment_intents')
    .select('id, commission_lassi, moyen_paiement, external_ref, montant_total')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!pi) {
    return new Response(JSON.stringify({ error: 'payment_intent_not_found' }), { status: 400, headers: CORS });
  }

  // — Montant réellement payé par le client = montant_total (prix_base + commission LASSI)
  const montantRemboursement = pi.montant_total ?? order.total;

  // — Numéro client : requis uniquement pour OM (le refund Wave reverse la session d'origine)
  let clientPhone: string | null = order.client_phone ?? null;
  if (!clientPhone && order.client_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', order.client_id)
      .maybeSingle();
    clientPhone = profile?.phone ?? null;
  }
  if (clientPhone) clientPhone = clientPhone.replace(/^\+?221/, '').trim();
  if (!clientPhone || !PHONE_RE.test(clientPhone)) {
    const fromNote = phoneFromNote(order.note);
    if (fromNote) clientPhone = fromNote;
  }

  // OM a besoin du numéro ; Wave rembourse via la session checkout (pas de numéro requis)
  if (order.pay_method === 'om' && (!clientPhone || !PHONE_RE.test(clientPhone))) {
    return new Response(JSON.stringify({ error: 'client_phone_invalid' }), { status: 400, headers: CORS });
  }
  if (order.pay_method === 'wave' && !pi.external_ref) {
    return new Response(JSON.stringify({ error: 'wave_session_missing' }), { status: 400, headers: CORS });
  }

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
      payoutRef = await sendWaveRefund({ refundId, sessionId: pi.external_ref!, montant: montantRemboursement });
    } else {
      payoutRef = await sendOmRefund({ refundId, montant: montantRemboursement, phone: clientPhone! });
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
  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', orderId);
  if (updErr) console.error('[process-refund] maj statut refunded échouée:', updErr.message);

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
// Rembourse la session checkout d'origine (reverse le paiement exact du client).
// Fiable : pas besoin de solde payout ni de numéro, le client est recrédité sur
// le moyen qu'il a utilisé pour payer.
async function sendWaveRefund(p: { refundId: string; sessionId: string; montant: number }): Promise<string> {
  const res = await waveRequestRefund(p.sessionId, '', p.refundId);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j.message ?? j.code ?? text; } catch { /* texte brut */ }
    throw new Error(`Wave refund ${res.status}: ${detail}`);
  }
  return p.sessionId;
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
