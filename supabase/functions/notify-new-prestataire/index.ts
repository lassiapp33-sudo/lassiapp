// Edge Function — notifie tous les clients quand un nouveau prestataire s'inscrit.
// Déclenchée par un trigger SQL sur shops (AFTER INSERT) via pg_net.http_post.
// Déployer : supabase functions deploy notify-new-prestataire

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

    const { shopId, shopName, category } = await req.json() as {
      shopId:   string;
      shopName: string;
      category: string;
    };

    if (!shopId || !shopName) return fail('Paramètres manquants', 400);

    const categoryLabel = CATEGORY_LABELS[category] ?? category ?? 'Services';
    const body  = `${shopName} vient de rejoindre LASSI — ${categoryLabel}`;

    // Annonce in-app uniquement (popup dans l'app — le push n'est pas utilisé pour ce cas)
    // tag = shopId permet la navigation directe vers la vitrine au tap sur l'annonce
    await sb.from('annonces').insert({
      titre:     'Nouveau prestataire !',
      corps:     body,
      icone:     '🏪',
      tag:       shopId,
      audience:  'clients',
      expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return ok({ sent: true });

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
