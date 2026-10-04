// Edge Function — notifie le destinataire d'un nouveau message chat
// Appelée par chat.ts après insertion du message (best-effort, pas critique).
// Auth : JWT utilisateur (anon key côté client).
// Body : { conversationId: string, preview: string }
// Déployer : supabase functions deploy notify-new-message

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPushTokens, sendExpoPush } from '../_shared/push.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')         ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Authentifier l'appelant (JWT utilisateur)
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || token === SUPABASE_ANON) {
      return fail('Non autorisé', 401);
    }

    // Client avec JWT utilisateur pour récupérer son identity
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !user) return fail('Non autorisé', 401);

    // 2. Paramètres
    const { conversationId, preview } = await req.json() as {
      conversationId: string;
      preview:        string;
    };
    if (!conversationId || !preview) return fail('Paramètres manquants', 400);

    // 3. Récupérer la conversation (service_role pour passer RLS)
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: conv, error: convErr } = await sb
      .from('conversations')
      .select('client_id, shop_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) return fail('Conversation introuvable', 404);

    // 4. Déterminer le destinataire (l'autre participant)
    let recipientId: string;
    if (user.id === conv.client_id) {
      // Expéditeur = client → notifier le marchand
      const { data: shop } = await sb
        .from('shops')
        .select('merchant_id')
        .eq('id', conv.shop_id)
        .single();
      if (!shop) return ok({ sent: false, reason: 'Boutique introuvable' });
      recipientId = shop.merchant_id as string;
    } else {
      // Expéditeur = marchand → notifier le client
      recipientId = conv.client_id as string;
    }

    if (recipientId === user.id) return ok({ sent: false, reason: 'Auto-notification ignorée' });

    // 5. Nom de l'expéditeur
    const { data: senderProfile } = await sb
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    const senderName = (senderProfile?.name as string) ?? 'LASSI';

    // 6. Push avec son + priority high
    const tokens = await getPushTokens(sb, recipientId);
    if (tokens.length === 0) return ok({ sent: false, reason: 'Aucun token push' });

    await sendExpoPush(tokens.map(to => ({
      to,
      title:             senderName,
      body:              preview,
      sound:             'default',
      channelId:         'messages-v2',
      priority:          'high' as const,
      _contentAvailable: false,
      data:              { type: 'new_message', conversationId },
    })));

    return ok({ sent: true });

  } catch (e) {
    console.error('[notify-new-message]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

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
