// ============================================================
// EDGE FUNCTION : upload-bloc-image
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET                = 'bloc-images';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-file-ext',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // ── 1. Extraire le JWT ────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Valider le JWT via admin (pas de query platform_users) ──
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Lire le corps binaire ──────────────────────────────
    const ext      = (req.headers.get('x-file-ext') ?? 'jpg').toLowerCase().replace(/[^a-z]/g, '');
    const mime     = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = `${user.id}/${Date.now()}.${ext}`;

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Fichier vide' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Upload avec service_role ───────────────────────────
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(filename, arrayBuffer, { contentType: mime, upsert: true });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. URL publique ───────────────────────────────────────
    const { data } = admin.storage.from(BUCKET).getPublicUrl(filename);
    return new Response(JSON.stringify({ url: data.publicUrl }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
