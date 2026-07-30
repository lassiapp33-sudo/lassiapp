// Edge Function — notification quotidienne "À la une"
// Appelée par pg_cron à 13h00 et 20h00 UTC via pg_net.
// N'envoie que si au moins 1 bloc "À la une" est actif au moment de l'appel.
// Déployer : supabase functions deploy notify-alaune-cron

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET   = Deno.env.get('CRON_SECRET')               ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Auth : CRON_SECRET uniquement (appel depuis pg_cron via pg_net)
  const cronSecret = req.headers.get('X-Cron-Secret');
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return fail('Non autorisé', 401);
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    // 1. Vérifier qu'il y a au moins 1 bloc "À la une" actif et non expiré
    const { count, error: countErr } = await sb
      .from('a_la_une')
      .select('id', { count: 'exact', head: true })
      .eq('actif', true)
      .gt('expire_at', new Date().toISOString());

    if (countErr) throw new Error(countErr.message);

    if (!count || count === 0) {
      return ok({ sent: false, reason: 'Aucun bloc À la une actif.' });
    }

    const title = '✨ Nouveautés À la une !';
    const body  = `${count} offre${count > 1 ? 's' : ''} vous attend${count > 1 ? 'ent' : ''} sur LASSI. Découvrez-les maintenant.`;

    // 2. Récupérer tous les clients
    const { data: clients, error: clientErr } = await sb
      .from('profiles')
      .select('id')
      .eq('role', 'client');

    if (clientErr) throw new Error(clientErr.message);

    const clientIds = (clients ?? []).map(r => r.id as string);
    if (clientIds.length === 0) return ok({ sent: false, reason: 'Aucun client.' });

    // 3. Insérer une notification individuelle par client (table notifications)
    //    → déclenche Realtime + persistant dans la boîte même si le client est inactif
    const notifRows = clientIds.map(userId => ({
      user_id: userId,
      type:    'ann',
      title,
      body,
      data:    { type: 'a_la_une_feed', target_id: 'a_la_une_feed' },
      is_read: false,
    }));

    // Insérer par lots de 500 pour éviter les timeouts
    const INSERT_BATCH = 500;
    for (let i = 0; i < notifRows.length; i += INSERT_BATCH) {
      await sb.from('notifications').insert(notifRows.slice(i, i + INSERT_BATCH));
    }

    // 4. Récupérer les tokens push des clients
    const { data: tokenRows } = await sb
      .from('push_tokens')
      .select('token')
      .in('user_id', clientIds);

    const pushTokens = (tokenRows ?? [])
      .map(r => r.token as string)
      .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

    if (pushTokens.length === 0) return ok({ sent: true, notifsSent: clientIds.length, pushSent: 0, reason: 'Aucun token push.' });

    // 5. Envoi push en lots de 100 (limite Expo Push API)
    const BATCH_SIZE = 100;
    let totalPushed  = 0;

    for (let i = 0; i < pushTokens.length; i += BATCH_SIZE) {
      const batch    = pushTokens.slice(i, i + BATCH_SIZE);
      const messages = batch.map(to => ({
        to,
        title,
        body,
        data:  { type: 'a_la_une_feed' },
        sound: 'default',
      }));

      const expoRes = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(messages),
      });

      const expoData = await expoRes.json().catch(() => ({}));
      const tickets: Array<Record<string, unknown>> = Array.isArray(expoData.data)
        ? expoData.data : [];

      const expiredTokens: string[] = [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (
          ticket?.status === 'error' &&
          (ticket.details as Record<string, unknown>)?.error === 'DeviceNotRegistered'
        ) expiredTokens.push(batch[j]);
      }
      if (expiredTokens.length > 0) {
        await sb.from('push_tokens').delete().in('token', expiredTokens);
      }

      totalPushed += batch.length;
    }

    return ok({ sent: true, notifsSent: clientIds.length, pushSent: totalPushed, activeBlocs: count });

  } catch (e) {
    console.error('[notify-alaune-cron]', e);
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
