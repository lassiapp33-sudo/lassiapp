// Edge Function — webhook Orange Money, appelé automatiquement après paiement
// URL à configurer : notif_url dans create-payment (POST) + OM Developer Dashboard
// Gère : flux ticket (référence LASSI_*) ET flux order (référence UUID payment_intents.id)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent }     from '../_shared/payment_utils.ts';

const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET')          ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')               ?? '';
const SUPABASE_SRK      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?? '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  try {
    // ── Lecture du body (POST = notif_url, GET = return_url) ─────────────────
    let reference: string | null = null;
    let status: string | null    = null;
    let rawBody = '';

    if (req.method === 'POST') {
      rawBody   = await req.text();
      const body = rawBody ? JSON.parse(rawBody) : {};
      reference  = body.order_id ?? body.reference ?? null;
      status     = body.status   ?? null;
    } else {
      const url = new URL(req.url);
      reference  = url.searchParams.get('order_id') ?? url.searchParams.get('reference');
      status     = url.searchParams.get('status');
    }

    // ── Vérification HMAC optionnelle (si secret configuré — requise en prod) ─
    if (OM_WEBHOOK_SECRET) {
      const omSig = req.headers.get('x-om-signature') ?? req.headers.get('x-orange-signature') ?? '';
      if (omSig && rawBody) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(OM_WEBHOOK_SECRET),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        );
        const mac      = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
        const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
        const sigNorm  = omSig.startsWith('sha256=') ? omSig.slice(7) : omSig;
        if (!timingSafeEqual(expected, sigNorm)) {
          console.error('[om-webhook] Signature invalide');
          return new Response('Signature invalide', { status: 401 });
        }
      }
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    await logEvent(sb, {
      event_type:        'webhook_received',
      provider:          'orange_money',
      reference:         reference ?? '',
      status:            'received',
      provider_response: { status, method: req.method },
    });

    if (!reference) {
      console.error('[om-webhook] reference/order_id absent');
      return new Response('reference manquante', { status: 400 });
    }

    // Orange Money statuts de succès connus
    const paid = status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'SUCCESSFULL';

    // ── Flux ORDER (référence = UUID payment_intents.id) ──────────────────────
    if (UUID_RE.test(reference)) {
      if (!paid) {
        return new Response('payment not successful', { status: 200 });
      }

      const piId = reference;

      await sb.from('payment_intents').update({
        external_status: status,
        statut:          'confirmed',
        confirmed_at:    new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }).eq('id', piId).in('statut', ['pending', 'initiated']);

      const { data: rpcResult, error: rpcError } = await sb.rpc(
        'confirm_order_from_payment',
        { p_payment_intent_id: piId },
      );
      if (rpcError) {
        console.error('[om-webhook] confirm_order_from_payment erreur:', rpcError.message);
      } else if (rpcResult && !rpcResult.ok) {
        console.error('[om-webhook] confirm_order_from_payment ko:', JSON.stringify(rpcResult));
      }

      await logEvent(sb, {
        event_type: 'verify_success',
        reference:  piId,
        provider:   'orange_money',
        method:     'orange_money',
        status:     'confirmed',
        metadata:   { source: 'webhook', flow: 'order' },
      });

      return new Response('ok', { status: 200 });
    }

    // ── Flux TICKET (référence = LASSI_{ticketId}_{timestamp}) ───────────────
    if (reference.startsWith('LASSI_')) {
      if (!paid) {
        return new Response('payment not successful', { status: 200 });
      }

      const lastUnderscore = reference.lastIndexOf('_');
      const ticketId       = reference.slice('LASSI_'.length, lastUnderscore);

      if (!ticketId) {
        console.error('[om-webhook] ticketId vide dans la référence', reference);
        return new Response('reference invalide', { status: 400 });
      }

      await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });

      await logEvent(sb, {
        event_type: 'verify_success',
        reference,
        ticket_id:  ticketId,
        provider:   'orange_money',
        method:     'orange_money',
        status:     'paid',
        metadata:   { source: 'webhook', flow: 'ticket' },
      });

      return new Response('ok', { status: 200 });
    }

    console.error('[om-webhook] Référence non reconnue:', reference);
    return new Response('reference non reconnue', { status: 400 });

  } catch (e) {
    console.error('[om-webhook]', e);
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
