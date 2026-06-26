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
    // 1. Authentification — réservé aux appels internes (service_role uniquement)
    // Les utilisateurs de l'app mobile ne doivent jamais pouvoir appeler cet endpoint
    // directement (risque de spam de notifications vers n'importe qui).
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!SUPABASE_SRK || token !== SUPABASE_SRK) {
      return fail('Non autorisé', 401);
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

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

    // 3. Rate limiting : max 60 notifications / heure vers le même destinataire
    const { data: rl } = await sb.rpc('check_rate_limit', {
      p_key:            `push:${targetUserId}`,
      p_max_attempts:   60,
      p_window_seconds: 3600,
      p_block_seconds:  0,
    });
    if (rl?.allowed === false) return fail('Trop de notifications envoyées.', 429);

    // 4. Récupérer les push tokens du destinataire (table push_tokens — multi-device)
    // IMPORTANT : profiles.push_token n'est jamais alimenté par l'app. La table
    // push_tokens est la seule source fiable des tokens Expo.
    const { data: tokenRows, error: tokenErr } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUserId);

    if (tokenErr) throw new Error(tokenErr.message);

    const pushTokens = (tokenRows ?? [])
      .map(r => r.token as string)
      .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

    if (pushTokens.length === 0) {
      return ok({ sent: false, reason: 'Pas de token push enregistré.' });
    }

    // 5. Envoyer via Expo Push API (tous les appareils du destinataire)
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(pushTokens.map(to => ({
        to,
        title,
        body,
        data:  data ?? {},
        sound: 'default',
      }))),
    });

    const expoData = await expoRes.json();

    // 6. Nettoyer les tokens expirés signalés par Expo
    const tickets: Array<Record<string, unknown>> = Array.isArray(expoData.data)
      ? expoData.data
      : [expoData.data].filter(Boolean);

    const expiredTokens: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === 'error' && (ticket.details as Record<string, unknown>)?.error === 'DeviceNotRegistered') {
        expiredTokens.push(pushTokens[i]);
      }
    }
    if (expiredTokens.length > 0) {
      await sb.from('push_tokens').delete().in('token', expiredTokens);
    }

    const sent = tickets.some(t => t?.status === 'ok');
    return ok({ sent, sentCount: pushTokens.length, expiredCleaned: expiredTokens.length });

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
