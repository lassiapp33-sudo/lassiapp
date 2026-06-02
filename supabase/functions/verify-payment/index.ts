// Edge Function — vérifie le statut d'un paiement Wave ou Orange Money
// Appelée par le bouton "J'ai payé" dans PaymentScreen

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WAVE_API_KEY  = Deno.env.get('WAVE_API_KEY')  ?? '';
const OM_API_KEY    = Deno.env.get('OM_API_KEY')    ?? '';
const OM_API_SECRET = Deno.env.get('OM_API_SECRET') ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')  ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { reference, ticketId, method } = await req.json() as {
      reference: string;
      ticketId:  string;
      method:    'wave' | 'om';
    };

    if (!reference || !ticketId) return fail('Paramètres manquants', 400);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    let paid: boolean;

    if (method === 'wave') {
      paid = await checkWavePayment(reference);
    } else {
      paid = await checkOmPayment(reference);
    }

    if (paid) {
      await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });
    }

    return ok({ paid });

  } catch (e) {
    console.error('[verify-payment]', e);
    return fail('Erreur interne', 500);
  }
});

// ─── Wave : vérifier via l'ID de session (client_reference) ──────────────────

async function checkWavePayment(reference: string): Promise<boolean> {
  // Wave permet de retrouver une session via son client_reference
  const res = await fetch(
    `https://api.wave.com/v1/checkout/sessions?client_reference=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${WAVE_API_KEY}` } },
  );
  const data = await res.json();
  // checkout_status = "complete" quand payé
  const session = data?.sessions?.[0] ?? data;
  return session?.checkout_status === 'complete' || session?.payment_status === 'succeeded';
}

// ─── Orange Money : vérifier via order_id ────────────────────────────────────

async function checkOmPayment(reference: string): Promise<boolean> {
  // Obtenir token
  const tokenRes = await fetch('https://api.orange.com/oauth/v3/token', {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${btoa(`${OM_API_KEY}:${OM_API_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const { access_token } = await tokenRes.json();

  const res = await fetch(
    `https://api.orange.com/orange-money-webpay/sn/v1/transactions/${reference}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  const data = await res.json();
  return data?.status === 'SUCCESSFULL' || data?.status === 'SUCCESS';
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
