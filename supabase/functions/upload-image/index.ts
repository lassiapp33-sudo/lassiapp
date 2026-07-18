// ============================================================
// EDGE FUNCTION : upload-image
// Upload proxy — contourne la validation de schéma storage-api
// en utilisant le service_role côté serveur.
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ALLOWED_BUCKETS = new Set([
  'products', 'logos', 'covers', 'avatars',
  'gallery', 'signalements', 'avis', 'disputes',
]);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bucket, x-path',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // 1. Auth
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 2. Paramètres
    const bucket = req.headers.get('x-bucket') ?? '';
    const path   = req.headers.get('x-path') ?? '';

    if (!ALLOWED_BUCKETS.has(bucket) || !path) {
      return new Response(JSON.stringify({ error: 'Bucket ou chemin invalide' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 3. Corps binaire
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Fichier vide' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 4. Upload via service_role (bypass schema check)
    const { error: uploadErr } = await admin.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 5. URL publique
    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return new Response(JSON.stringify({ url: data.publicUrl }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
