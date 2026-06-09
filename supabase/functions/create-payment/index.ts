// Edge Function — crée une session de paiement Wave ou Orange Money
// Architecture bancaire : idempotency + validation serveur + logs immuables + mode simulation
//
// Ingénieur Wave/OM : brancher ces 4 variables dans Supabase Dashboard → Settings → Edge Functions
//   WAVE_API_KEY          = votre clé API Wave Business
//   OM_API_KEY            = votre consumer key Orange Money
//   OM_API_SECRET         = votre consumer secret Orange Money
//   WAVE_WEBHOOK_SECRET   = secret HMAC configuré dans Wave Business Dashboard
//   (optionnel) PAYMENT_MODE = 'production'  (défaut: 'simulation')

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  validerMontant,
  validerMethode,
  logEvent,
  checkIdempotency,
  setIdempotency,
  calculerCommission,
} from '../_shared/payment_utils.ts';

const WAVE_API_KEY  = Deno.env.get('WAVE_API_KEY')              ?? '';
const OM_API_KEY    = Deno.env.get('OM_API_KEY')                ?? '';
const OM_API_SECRET = Deno.env.get('OM_API_SECRET')             ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PAYMENT_MODE  = Deno.env.get('PAYMENT_MODE')              ?? 'simulation';
const WEBHOOK_BASE  = `${SUPABASE_URL}/functions/v1`;

const isSimulation = () => PAYMENT_MODE !== 'production' || !WAVE_API_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json() as {
      // nouveau contrat (paymentService.ts)
      orderId?:        string;
      prixBase?:       number;
      moyenPaiement?:  string;
      // ancien contrat (payment.ts — terrain/ticket flows)
      ticketId?:       string;
      amount?:         number;
      method?:         string;
      merchantName?:   string;
      idempotencyKey?: string;
    };
    // alias : accepte les deux conventions de nommage
    const ticketId    = body.orderId      ?? body.ticketId   ?? '';
    const amount      = body.prixBase     ?? body.amount     ?? 0;
    const method      = body.moyenPaiement ?? body.method    ?? '';
    const merchantName = body.merchantName ?? '';
    const idempotencyKey = body.idempotencyKey;

    // ── Validation serveur ────────────────────────────────────────────────────
    if (!ticketId || !amount || !method)
      return fail('Paramètres manquants', 400);
    if (!validerMontant(amount))
      return fail(`Montant invalide (min 100, max 5 000 000 FCFA)`, 400);
    if (!validerMethode(method))
      return fail('Moyen de paiement non supporté', 400);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // ── Idempotency — évite les doublons sur retry réseau / double-clic ───────
    const iKey = idempotencyKey
      ?? req.headers.get('x-idempotency-key')
      ?? `pay_${ticketId}_${user.id}`;

    const cached = await checkIdempotency(sb, iKey);
    if (cached) {
      await logEvent(sb, {
        event_type: 'idempotency_hit',
        reference:  cached.reference as string,
        ticket_id:  ticketId,
        user_id:    user.id,
        method,
        status:     'idempotent',
      });
      return ok(cached);
    }

    const reference  = `LASSI_${ticketId}_${Date.now()}`;
    const commission = calculerCommission(amount);
    const provider   = method === 'wave' ? 'wave' : 'orange_money';

    await logEvent(sb, {
      event_type: 'create_initiated',
      reference,  ticket_id: ticketId, user_id: user.id,
      amount,     commission, method: provider, provider,
      status: 'initiated',
    });

    // ── Mode simulation (aucune clé API requise) ──────────────────────────────
    if (isSimulation()) {
      await sb.rpc('merge_ticket_reference', { p_message_id: ticketId, p_reference: reference });
      const result = {
        paymentUrl:  `lassi://simulate?ref=${encodeURIComponent(reference)}`,
        reference,
        simulation:  true,
      };
      await setIdempotency(sb, iKey, result);
      await logEvent(sb, {
        event_type: 'create_success',
        reference,  ticket_id: ticketId, user_id: user.id,
        amount,     commission, method: provider, provider: 'simulation',
        status: 'pending',
      });
      return ok(result);
    }

    // ── Mode production ───────────────────────────────────────────────────────
    let paymentUrl: string;
    try {
      paymentUrl = method === 'wave'
        ? await createWaveSession({ amount, reference, merchantName })
        : await createOmSession({ amount, reference, merchantName });
    } catch (e) {
      await logEvent(sb, {
        event_type:        'create_failed',
        reference,         ticket_id: ticketId, user_id: user.id,
        amount,            method: provider, provider,
        status:            'failed',
        provider_response: (e as Error).message,
      });
      throw e;
    }

    // Stocker la référence côté DB avant de retourner l'URL (atomicité)
    await sb.rpc('merge_ticket_reference', { p_message_id: ticketId, p_reference: reference });

    const result = { paymentUrl, reference };
    await setIdempotency(sb, iKey, result);
    await logEvent(sb, {
      event_type: 'create_success',
      reference,  ticket_id: ticketId, user_id: user.id,
      amount,     commission, method: provider, provider,
      status: 'pending',
    });

    return ok(result);

  } catch (e) {
    console.error('[create-payment]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

// ─── Wave Checkout API ────────────────────────────────────────────────────────
// Docs : https://developer.wave.com/docs/checkout-api

async function createWaveSession(p: {
  amount: number; reference: string; merchantName: string;
}): Promise<string> {
  const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${WAVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount:           String(p.amount),
      currency:         'XOF',
      client_reference: p.reference,
      success_url:      `${WEBHOOK_BASE}/wave-webhook`,
      error_url:        `${WEBHOOK_BASE}/wave-webhook`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.wave_launch_url) {
    console.error('[Wave] erreur:', data);
    throw new Error('Wave : session de paiement échouée');
  }
  return data.wave_launch_url;
}

// ─── Orange Money Web Payment API (Sénégal / WAEMU) ─────────────────────────
// Docs : https://developer.orange.com/apis/orange-money-webpay-senegal

async function createOmSession(p: {
  amount: number; reference: string; merchantName: string;
}): Promise<string> {
  const tokenRes = await fetch('https://api.orange.com/oauth/v3/token', {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${btoa(`${OM_API_KEY}:${OM_API_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[OM] token error:', tokenData);
    throw new Error('Orange Money : authentification échouée');
  }

  const payRes = await fetch('https://api.orange.com/orange-money-webpay/sn/v1/webpayment', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchant_key: OM_API_KEY,
      currency:     'OUV',
      order_id:     p.reference,
      amount:       p.amount,
      return_url:   `${WEBHOOK_BASE}/om-webhook`,
      cancel_url:   `${WEBHOOK_BASE}/om-webhook`,
      notif_url:    `${WEBHOOK_BASE}/om-webhook`,
      lang:         'fr',
      reference:    p.reference,
    }),
  });
  const payData = await payRes.json();
  if (!payRes.ok || !payData.payment_url) {
    console.error('[OM] payment error:', payData);
    throw new Error('Orange Money : création du paiement échouée');
  }
  return payData.payment_url;
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
