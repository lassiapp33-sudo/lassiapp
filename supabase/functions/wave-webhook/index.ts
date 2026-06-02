// Edge Function — webhook Wave, appelé automatiquement après paiement
// URL à configurer dans Wave Business Dashboard → Webhooks

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac }   from 'https://deno.land/std@0.168.0/node/crypto.ts';

const WAVE_WEBHOOK_SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')        ?? '';
const SUPABASE_SRK        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  try {
    const body = await req.text();

    // Vérifier la signature Wave (header : Wave-Signature)
    const signature = req.headers.get('wave-signature') ?? '';
    if (WAVE_WEBHOOK_SECRET && signature) {
      const expected = createHmac('sha256', WAVE_WEBHOOK_SECRET)
        .update(body).digest('hex');
      if (signature !== `sha256=${expected}`) {
        return new Response('Signature invalide', { status: 401 });
      }
    }

    const event = JSON.parse(body);

    // Wave envoie type: "checkout.session.completed" quand c'est payé
    if (event.type !== 'checkout.session.completed') {
      return new Response('ignored', { status: 200 });
    }

    const reference: string = event.data?.client_reference ?? '';
    if (!reference.startsWith('LASSI_')) {
      return new Response('not a LASSI payment', { status: 200 });
    }

    // Format LASSI_{ticketId}_{timestamp}
    const ticketId = reference.split('_')[1];

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);
    await sb.rpc('mark_ticket_paid', { p_message_id: ticketId });

    return new Response('ok', { status: 200 });

  } catch (e) {
    console.error('[wave-webhook]', e);
    return new Response('Erreur', { status: 500 });
  }
});
