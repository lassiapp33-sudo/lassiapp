// Edge Function — webhook Wave, appelé automatiquement après paiement
// URL à configurer dans Wave Business Dashboard → Webhooks
// Gère : flux ticket (référence LASSI_*) ET flux order (référence UUID payment_intents.id)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent }     from '../_shared/payment_utils.ts';

const WAVE_WEBHOOK_SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET')       ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// UUID v4 regex — distingue un payment_intent (flux order) d'une ref LASSI_* (flux ticket)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  try {
    const body = await req.text();

    // ── Vérification signature (requise — rejeter si secret absent) ───────────
    if (!WAVE_WEBHOOK_SECRET) {
      console.error('[wave-webhook] WAVE_WEBHOOK_SECRET non configuré');
      return new Response('Configuration manquante', { status: 500 });
    }

    const signature = req.headers.get('wave-signature') ?? '';
    if (!signature) {
      return new Response('Signature manquante', { status: 401 });
    }

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(WAVE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    const sigNorm  = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    if (!timingSafeEqual(expected, sigNorm)) {
      console.error('[wave-webhook] Signature invalide');
      return new Response('Signature invalide', { status: 401 });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response('Body invalide', { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    await logEvent(sb, {
      event_type:        'webhook_received',
      provider:          'wave',
      reference:         (event.data as Record<string, unknown>)?.client_reference as string ?? '',
      status:            'received',
      provider_response: { type: event.type },
    });

    // Wave envoie type: "checkout.session.completed" quand c'est payé
    if (event.type !== 'checkout.session.completed') {
      return new Response('ignored', { status: 200 });
    }

    const reference: string = ((event.data as Record<string, unknown>)?.client_reference as string) ?? '';
    if (!reference) {
      console.error('[wave-webhook] client_reference absent');
      return new Response('reference manquante', { status: 400 });
    }

    // ── Flux ORDER (référence = UUID payment_intents.id) ──────────────────────
    if (UUID_RE.test(reference)) {
      const piId = reference;

      await sb.from('payment_intents').update({
        external_status: 'succeeded',
        external_ref:    ((event.data as Record<string, unknown>)?.id as string) ?? null,
        statut:          'confirmed',
        confirmed_at:    new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }).eq('id', piId).in('statut', ['pending', 'initiated']);

      const { data: rpcResult, error: rpcError } = await sb.rpc(
        'confirm_order_from_payment',
        { p_payment_intent_id: piId },
      );
      if (rpcError) {
        console.error('[wave-webhook] confirm_order_from_payment erreur:', rpcError.message);
      } else if (rpcResult && !rpcResult.ok) {
        console.error('[wave-webhook] confirm_order_from_payment ko:', JSON.stringify(rpcResult));
      }

      await logEvent(sb, {
        event_type: 'verify_success',
        reference:  piId,
        provider:   'wave',
        method:     'wave',
        status:     'confirmed',
        metadata:   { source: 'webhook', flow: 'order' },
      });

      return new Response('ok', { status: 200 });
    }

    // ── Flux TICKET (référence = LASSI_{ticketId}_{timestamp}) ───────────────
    if (reference.startsWith('LASSI_')) {
      // Utiliser lastIndexOf('_') pour isoler ticketId même s'il contient des tirets
      const lastUnderscore = reference.lastIndexOf('_');
      const withoutTs      = reference.slice(0, lastUnderscore); // "LASSI_{ticketId}"
      const ticketId       = withoutTs.slice('LASSI_'.length);

      if (!ticketId) {
        console.error('[wave-webhook] ticketId vide dans la référence', reference);
        return new Response('reference invalide', { status: 400 });
      }

      await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });

      await logEvent(sb, {
        event_type: 'verify_success',
        reference,
        ticket_id:  ticketId,
        provider:   'wave',
        method:     'wave',
        status:     'paid',
        metadata:   { source: 'webhook', flow: 'ticket' },
      });

      return new Response('ok', { status: 200 });
    }

    console.error('[wave-webhook] Référence non reconnue:', reference);
    return new Response('reference non reconnue', { status: 400 });

  } catch (e) {
    console.error('[wave-webhook]', e);
    return new Response('Erreur', { status: 500 });
  }
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
