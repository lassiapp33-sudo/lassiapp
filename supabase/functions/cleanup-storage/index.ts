// Edge Function : cleanup-storage
// Supprime les fichiers storage orphelins + stories expirées
// Appel : POST /functions/v1/cleanup-storage (service_role uniquement)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractPath(url: string, bucket: string): string {
  // https://xxx.supabase.co/storage/v1/object/public/bucket/path/file.jpg
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : '';
}

async function listAllFiles(admin: ReturnType<typeof createClient>, bucket: string): Promise<string[]> {
  const paths: string[] = [];
  const queue = [''];
  while (queue.length > 0) {
    const prefix = queue.shift()!;
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) continue;
    for (const item of data) {
      if (item.id) {
        paths.push(prefix ? `${prefix}/${item.name}` : item.name);
      } else {
        queue.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }
  return paths;
}

// Supprime par batch de 100 pour éviter timeout
async function deleteOrphans(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  activeUrls: (string | null | undefined)[],
): Promise<{ deleted: number; errors: number }> {
  const active = new Set(activeUrls.map(u => extractPath(u ?? '', bucket)).filter(Boolean));
  const allFiles = await listAllFiles(admin, bucket);
  const orphans = allFiles.filter(f => !active.has(f));
  let deleted = 0, errors = 0;
  // Batch delete par 100
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) errors += batch.length;
    else deleted += batch.length;
  }
  return { deleted, errors };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const body = await req.json().catch(() => ({}));
  // bucket param : 'stories' | 'products' | 'avatars' | 'logos' | 'covers' | 'beauty' | 'order-vocals'
  // Si absent → stories expirées uniquement (rapide)
  const bucket: string = body.bucket ?? 'stories';

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  let result = { deleted: 0, errors: 0 };

  if (bucket === 'stories') {
    // Supprimer stories expirées >24h de la DB + storage
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await admin
      .from('ca_bouge_stories').select('id, media_url').lt('created_at', cutoff);
    const ids: string[] = [];
    for (const s of expired ?? []) {
      const path = extractPath(s.media_url ?? '', 'stories');
      if (path) {
        const { error } = await admin.storage.from('stories').remove([path]);
        if (!error) result.deleted++; else result.errors++;
      }
      ids.push(s.id);
    }
    if (ids.length) await admin.from('ca_bouge_stories').delete().in('id', ids);
    // + orphelins storage
    const { data: active } = await admin.from('ca_bouge_stories').select('media_url');
    const orph = await deleteOrphans(admin, 'stories', (active ?? []).map(s => s.media_url));
    result.deleted += orph.deleted;
    result.errors += orph.errors;

  } else if (bucket === 'products') {
    const { data } = await admin.from('products').select('image_url');
    result = await deleteOrphans(admin, 'products', (data ?? []).map(p => p.image_url));

  } else if (bucket === 'avatars') {
    const { data } = await admin.from('profiles').select('avatar_url');
    result = await deleteOrphans(admin, 'avatars', (data ?? []).map(p => p.avatar_url));

  } else if (bucket === 'logos') {
    const { data } = await admin.from('shops').select('logo_url');
    result = await deleteOrphans(admin, 'logos', (data ?? []).map(s => s.logo_url));

  } else if (bucket === 'covers') {
    const { data } = await admin.from('shops').select('cover_url');
    result = await deleteOrphans(admin, 'covers', (data ?? []).map(s => s.cover_url));

  } else if (bucket === 'beauty') {
    const { data } = await admin.from('beauty_services').select('image_url');
    result = await deleteOrphans(admin, 'beauty', (data ?? []).map(b => b.image_url));

  } else if (bucket === 'gallery') {
    // Récupère toutes les URLs actives dans shops.gallery_urls
    const { data: shops } = await admin.from('shops').select('gallery_urls');
    const activePaths = new Set<string>();
    for (const s of shops ?? []) {
      for (const url of (s.gallery_urls ?? [])) {
        const path = extractPath(url, 'gallery');
        if (path) activePaths.add(path);
      }
    }
    // Liste tous les fichiers du bucket gallery
    const allFiles = await listAllFiles(admin, 'gallery');
    const orphans = allFiles.filter(f => !activePaths.has(f));
    let deleted = 0, errors = 0;
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100);
      const { error } = await admin.storage.from('gallery').remove(batch);
      if (error) errors += batch.length; else deleted += batch.length;
    }
    result = { deleted, errors };

  } else if (bucket === 'order-vocals') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin.from('orders').select('vocal_url')
      .lt('created_at', cutoff).in('status', ['completed', 'cancelled', 'rejected'])
      .not('vocal_url', 'is', null);
    for (const o of data ?? []) {
      const path = extractPath(o.vocal_url ?? '', 'order-vocals');
      if (!path) continue;
      const { error } = await admin.storage.from('order-vocals').remove([path]);
      if (!error) result.deleted++; else result.errors++;
    }
  }

  return new Response(JSON.stringify({ success: true, bucket, ...result }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
