// Edge Function — envoie une notification push via Expo Push API
// Déclenchée par les triggers de notification (nouvelle commande, message, commande prête).
// Déployer : supabase functions deploy send-push

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types de notifications valides (whitelist)
type NotifType = 'new_order' | 'new_message' | 'order_ready' | 'order_paid' | 'debt_reminder';

const VALID_TYPES: NotifType[] = [
  'new_order', 'new_message', 'order_ready', 'order_paid', 'debt_reminder',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Authentification — seul un appel interne (service_role) est autorisé
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);

    // Vérification : le caller doit être authentifié (utilisateur ou appel interne)
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // 2. Paramètres
    const { targetUserId, type, title, body, data } = await req.json() as {
      targetUserId: string;
      type:         NotifType;
      title:        string;
      body:         string;
      data?:        Record<string, unknown>;
    };

    if (!targetUserId || !type || !title || !body) {
      return fail('Paramètres manquants', 400);
    }

    if (!VALID_TYPES.includes(type)) {
      return fail('Type de notification invalide', 400);
    }

    // Validation basique pour éviter les abus
    if (title.length > 100 || body.length > 300) {
      return fail('Titre ou corps trop longs', 400);
    }

    // 3. Rate limiting : max 60 notifications / heure par émetteur
    const { data: rateOk } = await sb.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action:  'send_push',
      p_max:     60,
      p_window:  '1 hour',
    });
    if (!rateOk) return fail('Trop de notifications envoyées.', 429);

    // 4. Récupérer le push token du destinataire
    const { data: profile, error: profErr } = await sb
      .from('profiles')
      .select('push_token')
      .eq('id', targetUserId)
      .single();

    if (profErr) throw new Error(profErr.message);

    // Si l'utilisateur n'a pas de token, ce n'est pas une erreur — il a refusé les notifs
    if (!profile?.push_token) {
      return ok({ sent: false, reason: 'Pas de token push enregistré.' });
    }

    // 5. Vérifier que le token est un token Expo valide
    const pushToken = profile.push_token as string;
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      return ok({ sent: false, reason: 'Token non Expo — ignoré.' });
    }

    // 6. Envoyer via Expo Push API
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to:    pushToken,
        title,
        body,
        data:  data ?? {},
        sound: 'default',
        // Icône + couleur configurées dans app.json
      }),
    });

    const expoData = await expoRes.json();

    // Expo peut retourner 200 même si la notif est en erreur (ex: token invalide)
    const ticket = expoData.data;
    if (ticket?.status === 'error') {
      console.warn('[send-push] Expo error:', ticket.details);
      // Token invalide → le nettoyer pour ne plus l'utiliser
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await sb.from('profiles').update({ push_token: null }).eq('id', targetUserId);
      }
      return ok({ sent: false, reason: ticket.message });
    }

    return ok({ sent: true, ticketId: ticket?.id });

  } catch (e) {
    console.error('[send-push]', e);
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
