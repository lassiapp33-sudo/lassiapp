// Edge Function — notifie tous les clients quand un nouveau prestataire s'inscrit.
// Déclenchée par un trigger SQL sur shops (AFTER INSERT) via pg_net.http_post.
// Déployer : supabase functions deploy notify-new-prestataire

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORY_LABELS: Record<string, string> = {
  // Catégories classiques
  stores:    'Commerçants',
  tangana:   'Tangana / Ndéki',
  bakery:    'Boulangerie',
  food:      'Restos & Boissons',
  fruiterie: 'Fruiterie',
  hair:      'Coiffeurs & Salons',
  sport:     'Sport',
  // Catégories VIP 5 Étoiles
  restauration:           'Restaurant 5 Étoiles',
  beaute_tressage:        'Salon Beauté & Tressage',
  coiffure:               'Salon de Coiffure',
  musculation_fitness:    'Salle de Sport & Fitness',
  boulangerie_patisserie: 'Boulangerie & Pâtisserie',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Auth : vérifie que le token JWT a le rôle service_role (appel interne trigger SQL)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
    let jwtRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
      jwtRole = payload?.role ?? null;
    } catch { /* token malformé */ }

    if (jwtRole !== 'service_role') {
      console.error('[notify-new-prestataire] Auth échouée — rôle JWT:', jwtRole ?? '(absent)');
      return fail('Non autorisé', 401);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    const { shopId, shopName, category, shopCreatedAt } = await req.json() as {
      shopId:        string;
      shopName:      string;
      category:      string;
      shopCreatedAt: string; // ISO 8601 — timestamp d'insertion du shop dans shops
    };

    if (!shopId || !shopName) return fail('Paramètres manquants', 400);

    const categoryLabel = CATEGORY_LABELS[category] ?? category ?? 'Services';
    const title = '🏪 Nouveau prestataire !';
    const body  = `${shopName} vient de rejoindre LASSI — ${categoryLabel}`;

    // 1. Récupérer uniquement les clients qui existaient AVANT (ou au moment)
    //    de la création du shop.
    //    pg_net est asynchrone : sans ce filtre, l'EF peut s'exécuter avec un
    //    délai et inclure des clients inscrits APRÈS le prestataire, leur
    //    envoyant des notifications sur un "nouveau" prestataire qui était
    //    en réalité déjà là avant eux.
    const baseQuery = sb.from('profiles').select('id').eq('role', 'client');
    const { data: clients, error: clientErr } = await (
      shopCreatedAt ? baseQuery.lte('created_at', shopCreatedAt) : baseQuery
    );

    if (clientErr) throw new Error(clientErr.message);

    const clientIds = (clients ?? []).map(r => r.id as string);
    if (clientIds.length === 0) return ok({ sent: false, reason: 'Aucun client antérieur.' });

    // 2. Insérer une notification individuelle par client (table notifications)
    //    → déclenche Realtime + popup NotifCardModal + bouton "Voir la vitrine"
    const notifRows = clientIds.map(userId => ({
      user_id: userId,
      type:    'ann',
      title,
      body,
      data:    { type: 'new_shop', shop_id: shopId, shop_name: shopName, target_id: shopId },
      is_read: false,
    }));

    // Insérer par lots de 500 pour éviter les timeouts
    const INSERT_BATCH = 500;
    for (let i = 0; i < notifRows.length; i += INSERT_BATCH) {
      await sb.from('notifications').insert(notifRows.slice(i, i + INSERT_BATCH));
    }

    // 3. Récupérer les tokens push des clients
    const { data: tokenRows } = await sb
      .from('push_tokens')
      .select('token')
      .in('user_id', clientIds);

    const pushTokens = (tokenRows ?? [])
      .map(r => r.token as string)
      .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

    if (pushTokens.length === 0) {
      return ok({ sent: true, notifsSent: clientIds.length, pushSent: 0, reason: 'Aucun token push.' });
    }

    // 4. Envoi push en lots de 100 (limite Expo Push API)
    const BATCH_SIZE = 100;
    let totalPushed  = 0;

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

    return ok({ sent: true, notifsSent: clientIds.length, pushSent: totalPushed });

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
