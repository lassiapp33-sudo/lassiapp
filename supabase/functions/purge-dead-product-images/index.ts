// Edge Function — purge les photo_url de produits dont le fichier a été supprimé
// du storage (incident perte images). Une photo_url http qui renvoie 404 fausse
// le gate `has_enough_images` (≥30% d'images) : la boutique paraît pleine alors
// qu'à l'écran les produits sont vides.
//
// Action : pour chaque produit avec photo_url LIKE 'http%', HEAD le fichier ;
//          si 404/400 → photo_url = NULL. Le trigger trg_products_image_gate
//          recalcule has_enough_images → boutique masquée si <30% d'images réelles.
//
// Auth : service_role uniquement (header Authorization: Bearer <service_role>).
// Body (optionnels) : { dryRun?: boolean, limit?: number }
//   - dryRun : compte les URL mortes SANS modifier.
//   - limit  : plafond de produits traités (défaut : tous).
//
// Déployer : supabase functions deploy purge-dead-product-images
// Invoquer : curl -X POST .../functions/v1/purge-dead-product-images \
//              -H "Authorization: Bearer <SERVICE_ROLE>" -d '{"dryRun":true}'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Un fichier est "vivant" si le HEAD renvoie 2xx. 404/400 (NoSuchKey) = mort.
async function isAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return true; // réseau KO → on ne supprime pas par prudence
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Garde service_role
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(SUPABASE_SRK) || SUPABASE_SRK === '') {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = Boolean(body?.dryRun);
  const limit: number | null = Number.isFinite(body?.limit) ? Number(body.limit) : null;

  const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

  // Pagination : récupère tous les produits avec une photo_url http
  const pageSize = 1000;
  let from = 0;
  const dead: string[] = [];
  let scanned = 0;

  while (true) {
    let q = sb
      .from('products')
      .select('id, photo_url')
      .like('photo_url', 'http%')
      .range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!data || data.length === 0) break;

    // HEAD en parallèle par lots de 20
    for (let i = 0; i < data.length; i += 20) {
      const chunk = data.slice(i, i + 20);
      const results = await Promise.all(
        chunk.map(async (p: any) => ({ id: p.id, alive: await isAlive(p.photo_url) })),
      );
      for (const r of results) {
        scanned++;
        if (!r.alive) dead.push(r.id);
      }
      if (limit && scanned >= limit) break;
    }

    if (data.length < pageSize) break;
    if (limit && scanned >= limit) break;
    from += pageSize;
  }

  let updated = 0;
  if (!dryRun && dead.length > 0) {
    // UPDATE par lots de 200 ids → trigger recalcule has_enough_images par boutique
    for (let i = 0; i < dead.length; i += 200) {
      const ids = dead.slice(i, i + 200);
      const { error, count } = await sb
        .from('products')
        .update({ photo_url: null }, { count: 'exact' })
        .in('id', ids);
      if (error) {
        return new Response(JSON.stringify({ error: error.message, updatedSoFar: updated }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      updated += count ?? ids.length;
    }
  }

  return new Response(
    JSON.stringify({ scanned, dead: dead.length, updated, dryRun }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
