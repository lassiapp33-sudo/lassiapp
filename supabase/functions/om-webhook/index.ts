// Edge Function — webhook Orange Money, appelé automatiquement après paiement
// URL à configurer dans Orange Developer Dashboard → notif_url

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent }     from '../_shared/payment_utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  try {
    // OM peut envoyer en GET (return_url) ou POST (notif_url)
    let reference: string | null = null;
    let status: string | null    = null;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      reference = body.order_id ?? body.reference ?? null;
      status    = body.status   ?? null;
    } else {
      const url = new URL(req.url);
      reference = url.searchParams.get('order_id') ?? url.searchParams.get('reference');
      status    = url.searchParams.get('status');
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    await logEvent(sb, {
      event_type:        'webhook_received',
      provider:          'orange_money',
      reference:         reference ?? '',
      status:            'received',
      provider_response: { status, method: req.method },
    });

    if (!reference?.startsWith('LASSI_')) {
      return new Response('not a LASSI payment', { status: 200 });
    }

    // Orange Money : status = "SUCCESS" ou "SUCCESSFULL"
    const paid = status === 'SUCCESS' || status === 'SUCCESSFULL';
    if (!paid) {
      return new Response('payment not successful', { status: 200 });
    }

    const ticketId = reference.split('_')[1];

    await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });

    await logEvent(sb, {
      event_type: 'verify_success',
      reference,
      ticket_id:  ticketId,
      provider:   'orange_money',
      method:     'orange_money',
      status:     'paid',
      metadata:   { source: 'webhook' },
    });

    return new Response('ok', { status: 200 });

  } catch (e) {
    console.error('[om-webhook]', e);
    return new Response('Erreur', { status: 500 });
  }
});
