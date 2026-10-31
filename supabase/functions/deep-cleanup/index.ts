// Edge Function : deep-cleanup
// 1. Supprime galleries de marchands inactifs (0 commande depuis 60j)
// 2. Supprime voice-notes/chat-media/order-vocals anciens (>30j)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function extractPath(url: string, bucket: string): string {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode ?? 'dry_run'; // 'dry_run' | 'execute'
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const report: Record<string, unknown> = { mode };

  // ── 1. Galleries marchands inactifs (pas de commande depuis 60j) ───────
  const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Récupère tous les shops avec gallery
  const { data: shops } = await admin
    .from('shops')
    .select('id, user_id, name, gallery_urls')
    .not('gallery_urls', 'eq', '{}')
    .not('gallery_urls', 'is', null);

  const inactiveShops: { id: string; name: string; nb_photos: number }[] = [];
  let gallery_files_to_delete: string[] = [];

  for (const shop of shops ?? []) {
    if (!shop.gallery_urls?.length) continue;
    // Vérifie si une commande récente existe
    const { count } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .gte('created_at', cutoff60);

    if ((count ?? 0) === 0) {
      inactiveShops.push({ id: shop.id, name: shop.name, nb_photos: shop.gallery_urls.length });
      for (const url of shop.gallery_urls) {
        const path = extractPath(url, 'gallery');
        if (path) gallery_files_to_delete.push(path);
      }
    }
  }

  report['inactive_shops'] = inactiveShops.length;
  report['gallery_files_to_delete'] = gallery_files_to_delete.length;
  report['inactive_shops_list'] = inactiveShops.slice(0, 10); // preview

  // ── 2. Voice-notes anciens >30j ────────────────────────────────────────
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const oldBuckets = ['voice-notes', 'voice-messages', 'chat-media', 'order-vocals'];
  const old_files: Record<string, string[]> = {};

  for (const bucket of oldBuckets) {
    // Liste les fichiers via storage API puis filtre par date created_at dans storage.objects
    const { data: objs } = await admin.storage.from(bucket).list('', { limit: 1000 });
    // Récupère les noms de fichiers avec created_at via une RPC ou filtre sur date
    // On utilise le metadata.lastModified comme approximation
    const cutoffMs = Date.parse(cutoff30);
    old_files[bucket] = (objs ?? [])
      .filter(o => o.metadata?.size && o.updated_at && Date.parse(o.updated_at) < cutoffMs)
      .map(o => o.name);
    report[`${bucket}_old_count`] = old_files[bucket].length;
  }

  if (mode === 'dry_run') {
    return new Response(JSON.stringify({ ...report, action: 'DRY RUN — rien supprimé' }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // ── EXECUTE ────────────────────────────────────────────────────────────
  let total_deleted = 0;

  // Supprimer galleries inactifs par batch
  for (let i = 0; i < gallery_files_to_delete.length; i += 100) {
    const batch = gallery_files_to_delete.slice(i, i + 100);
    const { error } = await admin.storage.from('gallery').remove(batch);
    if (!error) total_deleted += batch.length;
  }
  // Vider gallery_urls dans la DB pour ces shops
  if (inactiveShops.length > 0) {
    const ids = inactiveShops.map(s => s.id);
    await admin.from('shops').update({ gallery_urls: [] }).in('id', ids);
  }

  // Supprimer fichiers audio anciens
  for (const bucket of oldBuckets) {
    const files = old_files[bucket];
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (!error) total_deleted += batch.length;
    }
  }

  report['total_deleted'] = total_deleted;
  report['action'] = 'EXECUTED';

  return new Response(JSON.stringify(report), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
