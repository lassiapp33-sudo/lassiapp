// Edge Function : storage-audit — taille par bucket
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function bucketSize(admin: ReturnType<typeof createClient>, bucket: string): Promise<{ count: number; size_mb: number }> {
  let count = 0, totalBytes = 0;
  const queue = [''];
  while (queue.length > 0) {
    const prefix = queue.shift()!;
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!data) continue;
    for (const item of data) {
      if (item.metadata?.size) {
        count++;
        totalBytes += item.metadata.size;
      } else {
        queue.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }
  return { count, size_mb: Math.round(totalBytes / 1024 / 1024 * 10) / 10 };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const buckets = ['products','logos','covers','avatars','gallery','chat-media','order-vocals','stories','voice-notes','beauty','avis','signalements','disputes'];
  const results: Record<string, { count: number; size_mb: number }> = {};
  for (const b of buckets) {
    try { results[b] = await bucketSize(admin, b); }
    catch { results[b] = { count: 0, size_mb: 0 }; }
  }
  const total_mb = Object.values(results).reduce((s, v) => s + v.size_mb, 0);
  return new Response(JSON.stringify({ total_mb: Math.round(total_mb * 10) / 10, buckets: results }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
