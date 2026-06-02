// Edge Function — crée une session de paiement Wave ou Orange Money
// Déployer : supabase functions deploy create-payment

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WAVE_API_KEY   = Deno.env.get('WAVE_API_KEY')   ?? '';
const OM_API_KEY     = Deno.env.get('OM_API_KEY')     ?? '';
const OM_API_SECRET  = Deno.env.get('OM_API_SECRET')  ?? '';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')   ?? '';
const SUPABASE_SRK   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_BASE   = `${SUPABASE_URL}/functions/v1`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { ticketId, amount, method, merchantName } = await req.json() as {
      ticketId:     string;
      amount:       number;
      method:       'wave' | 'om';
      merchantName: string;
    };

    if (!ticketId || !amount || !method) return fail('Paramètres manquants', 400);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    const reference = `LASSI_${ticketId}_${Date.now()}`;

    let paymentUrl: string;

    if (method === 'wave') {
      paymentUrl = await createWaveSession({ amount, reference, merchantName });
    } else {
      paymentUrl = await createOmSession({ amount, reference, merchantName });
    }

    // Stocker la référence pour la vérification
    await sb.rpc('merge_ticket_reference', { p_message_id: ticketId, p_reference: reference });

    return ok({ paymentUrl, reference });

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
  // wave_launch_url ouvre directement l'app Wave sur mobile
  return data.wave_launch_url;
}

// ─── Orange Money Web Payment API (Sénégal / WAEMU) ─────────────────────────
// Docs : https://developer.orange.com/apis/orange-money-webpay-senegal

async function createOmSession(p: {
  amount: number; reference: string; merchantName: string;
}): Promise<string> {
  // 1. Obtenir un token OAuth2
  const tokenRes = await fetch(
    'https://api.orange.com/oauth/v3/token',
    {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${btoa(`${OM_API_KEY}:${OM_API_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    },
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[OM] token error:', tokenData);
    throw new Error('Orange Money : authentification échouée');
  }

  // 2. Créer le paiement
  const payRes = await fetch(
    'https://api.orange.com/orange-money-webpay/sn/v1/webpayment',
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_key:   OM_API_KEY,
        currency:       'OUV',
        order_id:       p.reference,
        amount:         p.amount,
        return_url:     `${WEBHOOK_BASE}/om-webhook`,
        cancel_url:     `${WEBHOOK_BASE}/om-webhook`,
        notif_url:      `${WEBHOOK_BASE}/om-webhook`,
        lang:           'fr',
        reference:      p.reference,
      }),
    },
  );

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
