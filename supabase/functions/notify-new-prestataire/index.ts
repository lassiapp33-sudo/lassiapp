// Edge Function — notifie tous les clients quand un nouveau prestataire s'inscrit.
// Déclenchée par un trigger SQL sur shops (AFTER INSERT) via pg_net.http_post.
// Déployer : supabase functions deploy notify-new-prestataire

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORY_LABELS: Record<string, string> = {
  stores:    'Commerçants',
  tangana:   'Tangana / Ndéki',
  bakery:    'Boulangerie',
  food:      'Restos & Boissons',
  fruiterie: 'Fruiterie',
  hair:      'Coiffeurs & Salons',
  sport:     'Sport',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Auth : service_role uniquement (appel interne depuis trigger SQL)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!SUPABASE_SRK || token !== SUPABASE_SRK) {
      return fail('Non autorisé', 401);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    const { shopId, shopName, category } = await req.json() as {
      shopId:   string;
      shopName: string;
      category: string;
    };

    if (!shopId || !shopName) return fail('Paramètres manquants', 400);

    const categoryLabel = CATEGORY_LABELS[category] ?? category ?? 'Services';
    const title = '🆕 Nouveau prestataire !';
    const body  = `${shopName} vient de rejoindre LASSI — ${categoryLabel}`;

    // 1. Annonce in-app (cloche notifications côté clients)
    //    tag = shopId permet la navigation directe vers la vitrine au tap
    await sb.from('annonces').insert({
      titre:     'Nouveau prestataire !',
      corps:     body,
      icone:     '🆕',
      tag:       shopId,
      audience:  'clients',
      expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // 2. Récupérer les IDs de tous les clients
    const { data: clients, error: clientErr } = await sb
      .from('profiles')
      .select('id')
      .eq('role', 'client');

    if (clientErr) throw new Error(clientErr.message);

    const clientIds = (clients ?? []).map(r => r.id as string);
    if (clientIds.length === 0) return ok({ sent: false, reason: 'Aucun client.' });

    // 3. Récupérer leurs push tokens (multi-device)
    const { data: tokenRows, error: tokenErr } = await sb
      .from('push_tokens')
      .select('token')
      .in('user_id', clientIds);

    if (tokenErr) throw new Error(tokenErr.message);

    const pushTokens = (tokenRows ?? [])
      .map(r => r.token as string)
      .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

    if (pushTokens.length === 0) return ok({ sent: false, reason: 'Aucun token push client.' });

    // 4. Envoi en lots de 100 (limite Expo Push API)
    const BATCH_SIZE = 100;
    let totalPushed = 0;

    for (let i = 0; i < pushTokens.length; i += BATCH_SIZE) {
      const batch    = pushTokens.slice(i, i + BATCH_SIZE);
      const messages = batch.map(to => ({
        to,
        title,
        body,
        data:  { type: 'new_shop', shop_id: shopId, shop_name: shopName },
        sound: 'default',
      }));

      const expoRes = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(messages),
      });

      const expoData = await expoRes.json().catch(() => ({}));
      const tickets: Array<Record<string, unknown>> = Array.isArray(expoData.data)
        ? expoData.data
        : [];

      // Nettoyer les tokens expirés signalés par Expo
      const expiredTokens: string[] = [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (
          ticket?.status === 'error' &&
          (ticket.details as Record<string, unknown>)?.error === 'DeviceNotRegistered'
        ) {
          expiredTokens.push(batch[j]);
        }
      }
      if (expiredTokens.length > 0) {
        await sb.from('push_tokens').delete().in('token', expiredTokens);
      }

      totalPushed += batch.length;
    }

    return ok({ sent: true, totalPushed });

  } catch (e) {
    console.error('[notify-new-prestataire]', e);
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
