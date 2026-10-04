// Edge Function — vérifie le statut d'un paiement Wave ou Orange Money
// Deux contrats acceptés :
//   nouveau : { paymentIntentId } — flux order (CheckoutPayment / deep link)
//   ancien  : { reference, ticketId, method } — flux ticket/chat (PaymentScreen)
// Mode simulation : confirmation automatique sans appel API

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent }     from '../_shared/payment_utils.ts';

const WAVE_API_KEY  = Deno.env.get('WAVE_API_KEY')              ?? '';
const OM_API_KEY    = Deno.env.get('OM_API_KEY')                ?? '';
const OM_API_SECRET = Deno.env.get('OM_API_SECRET')             ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PAYMENT_MODE  = Deno.env.get('PAYMENT_MODE')              ?? 'simulation';

const isSimulation = () => PAYMENT_MODE !== 'production' || !WAVE_API_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json() as {
      // nouveau contrat (paymentService.ts + deep link)
      paymentIntentId?: string;
      // ancien contrat (payment.ts — flux ticket/chat)
      reference?:  string;
      ticketId?:   string;
      method?:     'wave' | 'om' | 'orange_money';
    };

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // ── Flux ORDER : vérification via payment_intents ─────────────────────────
    if (body.paymentIntentId) {
      const piId = body.paymentIntentId;

      const { data: pi, error: piErr } = await sb
        .from('payment_intents')
        .select('id, statut, moyen_paiement, external_ref, order_id')
        .eq('id', piId)
        .single();

      if (piErr || !pi) {
        console.error('[verify-payment] payment_intent introuvable:', piId, piErr?.message);
        return fail('Paiement introuvable', 404);
      }

      // Déjà confirmé ou traité → retour immédiat (idempotent)
      // 'simulated' n'est PAS ici : il doit passer par confirm_order_from_payment
      if (pi.statut === 'confirmed' || pi.statut === 'split_done') {
        return ok({ paid: true, confirmed: true, statut: pi.statut, mode: isSimulation() ? 'simulation' : 'production' });
      }

      await logEvent(sb, {
        event_type: 'verify_attempt',
        reference:  piId, ticket_id: pi.order_id ?? '', user_id: user.id,
        method:     pi.moyen_paiement, provider: pi.moyen_paiement,
        status:     'verifying',
      });

      // ── Simulation ──────────────────────────────────────────────────────────
      if (isSimulation()) {
        await sb.from('payment_intents').update({
          statut:       'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        }).eq('id', piId).in('statut', ['pending', 'initiated', 'simulated']);

        // Déclencher la commande
        const { error: rpcErr } = await sb.rpc('confirm_order_from_payment', {
          p_payment_intent_id: piId,
        });
        if (rpcErr) console.error('[verify-payment] confirm_order_from_payment:', rpcErr.message);

        await logEvent(sb, {
          event_type: 'verify_success',
          reference:  piId, ticket_id: pi.order_id ?? '', user_id: user.id,
          method:     pi.moyen_paiement, provider: 'simulation',
          status:     'confirmed',
        });
        return ok({ paid: true, confirmed: true, statut: 'confirmed', mode: 'simulation' });
      }

      // ── Production ──────────────────────────────────────────────────────────
      const provider = pi.moyen_paiement;
      // Pour Wave : utiliser external_ref (cos-*) si dispo (après webhook), sinon client_reference (UUID)
      let paid = provider === 'wave'
        ? await checkWavePayment(pi.external_ref ?? null, piId)
        : await checkOmPayment(piId);

      // Race condition : le webhook peut avoir confirmé le PI entre notre fetch initial et l'appel Wave/OM
      if (!paid) {
        const { data: piRefresh } = await sb
          .from('payment_intents')
          .select('statut')
          .eq('id', piId)
          .single();
        if (piRefresh?.statut === 'confirmed' || piRefresh?.statut === 'split_done') {
          paid = true;
        }
      }

      if (paid) {
        await sb.from('payment_intents').update({
          statut:       'confirmed',
          confirmed_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        }).eq('id', piId).in('statut', ['pending', 'initiated', 'simulated']);

        const { error: rpcErr } = await sb.rpc('confirm_order_from_payment', {
          p_payment_intent_id: piId,
        });
        if (rpcErr) console.error('[verify-payment] confirm_order_from_payment:', rpcErr.message);

        await logEvent(sb, {
          event_type: 'verify_success',
          reference:  piId, ticket_id: pi.order_id ?? '', user_id: user.id,
          method:     provider, provider,
          status:     'confirmed',
        });
      } else {
        await logEvent(sb, {
          event_type: 'verify_failed',
          reference:  piId, ticket_id: pi.order_id ?? '', user_id: user.id,
          method:     provider, provider,
          status:     'pending',
        });
      }

      return ok({ paid, confirmed: paid, statut: paid ? 'confirmed' : 'pending', mode: 'production' });
    }

    // ── Flux TICKET/CHAT legacy ───────────────────────────────────────────────
    const { reference, ticketId, method } = body;
    if (!reference || !ticketId) return fail('Paramètres manquants', 400);

    const provider = method === 'wave' ? 'wave' : 'orange_money';

    await logEvent(sb, {
      event_type: 'verify_attempt',
      reference,  ticket_id: ticketId, user_id: user.id,
      method:     provider, provider,
      status:     'verifying',
    });

    if (isSimulation()) {
      await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });
      await logEvent(sb, {
        event_type: 'verify_success',
        reference,  ticket_id: ticketId, user_id: user.id,
        method:     provider, provider: 'simulation',
        status:     'paid',
      });
      return ok({ paid: true, confirmed: true, statut: 'paid', mode: 'simulation' });
    }

    // Production — ticket (reference = client_reference passé à Wave, pas un session ID)
    const paid = method === 'wave'
      ? await checkWavePayment(null, reference)
      : await checkOmPayment(reference);

    if (paid) {
      await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });
      await logEvent(sb, {
        event_type: 'verify_success',
        reference,  ticket_id: ticketId, user_id: user.id,
        method:     provider, provider,
        status:     'paid',
      });
    } else {
      await logEvent(sb, {
        event_type: 'verify_failed',
        reference,  ticket_id: ticketId, user_id: user.id,
        method:     provider, provider,
        status:     'pending',
      });
    }

    return ok({ paid, confirmed: paid, statut: paid ? 'paid' : 'pending', mode: 'production' });

  } catch (e) {
    console.error('[verify-payment]', e);
    return fail('Erreur interne', 500);
  }
});

// ─── Wave : vérifier le statut d'un paiement ─────────────────────────────────
// sessionId = external_ref (cos-*) si connu (après webhook), sinon null
// clientRef = UUID du payment_intent (client_reference passé à Wave)

import { buildWaveSignature } from '../_shared/waveSign.ts';

async function checkWavePayment(sessionId: string | null, clientRef: string): Promise<boolean> {
  const sig = await buildWaveSignature('');
  const headers: Record<string, string> = { 'Authorization': `Bearer ${WAVE_API_KEY}` };
  if (sig) headers['Wave-Signature'] = sig;

  if (sessionId) {
    // GET direct via session ID (plus rapide, disponible après le webhook)
    const res = await fetch(
      `https://api.wave.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers },
    );
    if (!res.ok) return false;
    const data = await res.json() as Record<string, unknown>;
    const cs = String(data?.checkout_status ?? '');
    const ps = String(data?.payment_status  ?? '');
    return cs === 'complete' || ps === 'succeeded' || ps === 'SUCCESSFUL' || ps === 'paid' || ps === 'PAID';
  }

  // Fallback : recherche par client_reference (avant que le webhook n'ait rempli external_ref)
  const res = await fetch(
    `https://api.wave.com/v1/checkout/sessions?client_reference=${encodeURIComponent(clientRef)}`,
    { headers },
  );
  if (!res.ok) return false;
  const data = await res.json() as Record<string, unknown>;
  const session = (data as Record<string, unknown[]>)?.sessions?.[0] as Record<string, unknown> | undefined ?? data;
  const cs = String(session?.checkout_status ?? '');
  const ps = String(session?.payment_status  ?? '');
  return cs === 'complete' || ps === 'succeeded' || ps === 'SUCCESSFUL' || ps === 'paid' || ps === 'PAID';
}

// ─── Orange Money : vérifier via order_id ────────────────────────────────────

async function checkOmPayment(reference: string): Promise<boolean> {
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
  return data?.status === 'SUCCESSFUL' || data?.status === 'SUCCESSFULL' || data?.status === 'SUCCESS';
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
