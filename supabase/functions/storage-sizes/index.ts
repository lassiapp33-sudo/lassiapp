import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const { data, error } = await admin.rpc('storage_bucket_sizes');
  if (error) {
    // Fallback: query directe
    const { data: raw, error: e2 } = await (admin as any).from('storage.objects').select('bucket_id, metadata');
    return new Response(JSON.stringify({ error: error.message, e2: e2?.message }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify(data), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
});
