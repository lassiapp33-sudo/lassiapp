-- ============================================================
-- LASSI — Phase 3 Étape 4 : Photos + Sécurité
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ============================================================


-- ─── 1. NOUVELLES COLONNES ────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS logo_url TEXT;


-- ─── 2. STORAGE BUCKETS ───────────────────────────────────────────────────────
-- Crée les 4 buckets publics (les images sont visibles sans token)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('logos',    'logos',    true),
  ('products', 'products', true),
  ('covers',   'covers',   true),
  ('avatars',  'avatars',  true)
ON CONFLICT (id) DO NOTHING;


-- ─── 3. POLICIES STORAGE ─────────────────────────────────────────────────────

-- ── logos : lecture publique, écriture = utilisateur propriétaire du dossier ──
-- Le chemin est : {shopId}/logo_{ts}.jpg
-- On ne peut pas vérifier shopId → merchant côté SQL facilement,
-- donc on autorise tout utilisateur authentifié (le shopId est opaque).

DO $$ BEGIN CREATE POLICY "logos_public_read"   ON storage.objects FOR SELECT TO public      USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_write"    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_update"   ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_delete"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── products ──────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE POLICY "products_public_read"  ON storage.objects FOR SELECT TO public      USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_write"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── covers ────────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE POLICY "covers_public_read"  ON storage.objects FOR SELECT TO public      USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_write"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── avatars : chaque utilisateur accède uniquement à son propre dossier ───────

DO $$ BEGIN CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "avatars_own_write" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "avatars_own_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "avatars_own_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
