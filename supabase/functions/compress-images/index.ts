// Edge Function : compress-images
// Comprime les images JPEG/PNG en batch — appeler en boucle avec offset
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const QUALITY = 70; // JPEG quality 0-100
const BATCH   = 15; // fichiers par appel

async function listFiles(admin: ReturnType<typeof createClient>, bucket: string, prefix = '', limit = 1000): Promise<{ name: string; size: number }[]> {
  const results: { name: string; size: number }[] = [];
  const { data } = await admin.storage.from(bucket).list(prefix, { limit });
  for (const item of data ?? []) {
    if (item.metadata?.size) {
      results.push({ name: prefix ? `${prefix}/${item.name}` : item.name, size: item.metadata.size });
    } else if (!item.metadata) {
      // Sous-dossier
      const sub = await listFiles(admin, bucket, prefix ? `${prefix}/${item.name}` : item.name);
      results.push(...sub);
    }
  }
  return results;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const body = await req.json().catch(() => ({}));
  const bucket: string  = body.bucket ?? 'gallery';
  const offset: number  = body.offset ?? 0;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // Liste tous les fichiers du bucket
  const allFiles = await listFiles(admin, bucket);
  // Trie par taille décroissante pour traiter les plus gros en premier
  allFiles.sort((a, b) => b.size - a.size);

  const batch = allFiles.slice(offset, offset + BATCH);
  if (batch.length === 0) {
    return new Response(JSON.stringify({ done: true, total: allFiles.length }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let compressed = 0, skipped = 0, errors = 0;
  let saved_bytes = 0;

  for (const file of batch) {
    try {
      // Skip si trop petit (<30 KB) — compression inutile
      if (file.size < 30 * 1024) { skipped++; continue; }

      // Télécharger
      const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(file.name);
      if (dlErr || !blob) { errors++; continue; }

      const originalBytes = new Uint8Array(await blob.arrayBuffer());

      // Détecter le type
      const mime = blob.type;
      if (!mime.startsWith('image/')) { skipped++; continue; }
      // Skip audio/vidéo
      if (mime.includes('mp4') || mime.includes('webm') || mime.includes('audio')) { skipped++; continue; }

      // Compresser avec imagescript
      let compressed_bytes: Uint8Array;
      try {
        const img = await Image.decode(originalBytes);
        // Resize si > 2000px (économie supplémentaire)
        if (img.width > 2000 || img.height > 2000) {
          const ratio = Math.min(2000 / img.width, 2000 / img.height);
          img.resize(Math.round(img.width * ratio), Math.round(img.height * ratio));
        }
        compressed_bytes = await img.encodeJPEG(QUALITY);
      } catch {
        skipped++; continue;
      }

      // Ne réuploader que si gain > 10%
      if (compressed_bytes.length >= originalBytes.length * 0.9) { skipped++; continue; }

      const gain = originalBytes.length - compressed_bytes.length;

      // Réuploader
      const { error: upErr } = await admin.storage.from(bucket).upload(
        file.name, compressed_bytes,
        { contentType: 'image/jpeg', upsert: true }
      );
      if (upErr) { errors++; continue; }

      compressed++;
      saved_bytes += gain;
    } catch {
      errors++;
    }
  }

  const next_offset = offset + BATCH;
  const has_more = next_offset < allFiles.length;

  return new Response(JSON.stringify({
    bucket,
    offset,
    batch_size: batch.length,
    compressed,
    skipped,
    errors,
    saved_mb: Math.round(saved_bytes / 1024 / 1024 * 10) / 10,
    next_offset: has_more ? next_offset : null,
    total_files: allFiles.length,
    done: !has_more,
  }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
