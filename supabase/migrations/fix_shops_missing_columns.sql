-- ============================================================
-- LASSI — Fix complet : colonnes + RLS + Storage
-- SAFE à re-exécuter (IF NOT EXISTS / DO EXCEPTION partout)
-- À lancer dans Supabase > SQL Editor
-- ============================================================

-- ─── 1. COLONNES SHOPS ────────────────────────────────────────────────────────

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS reviews_count      INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subcategories      JSONB    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS shop_type          TEXT     NOT NULL DEFAULT 'products',
  ADD COLUMN IF NOT EXISTS address_text       TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours      JSONB,
  ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gallery_urls       JSONB    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url           TEXT,
  ADD COLUMN IF NOT EXISTS vip_manual            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vip_manual_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_manual        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_manual_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_note            TEXT;

-- Contrainte shop_type (ignorée si elle existe déjà)
DO $$ BEGIN
  ALTER TABLE shops ADD CONSTRAINT shops_shop_type_check
    CHECK (shop_type IN ('products','services','memberships'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. COLONNES PRODUCTS ─────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_type      TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS duration       INTEGER,
  ADD COLUMN IF NOT EXISTS formula_period TEXT;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_item_type_check
    CHECK (item_type IN ('product','service','membership'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_formula_period_check
    CHECK (formula_period IS NULL OR formula_period IN (
      'seance','jour','semaine','mois','trimestre','annee'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. COLONNES PROFILES ─────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
  ADD COLUMN IF NOT EXISTS auth_email  TEXT,
  ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT FALSE;

-- Remplir auth_email pour les comptes déjà créés (récupère l'email depuis auth.users)
UPDATE profiles p
SET auth_email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.auth_email IS NULL;

-- ─── 4. DÉRIVER shop_type POUR LES BOUTIQUES EXISTANTES ──────────────────────

UPDATE shops
  SET shop_type = CASE
    WHEN category = 'hair'  THEN 'services'
    WHEN category = 'sport' THEN 'memberships'
    ELSE 'products'
  END
WHERE shop_type = 'products';

-- ─── 5. DÉRIVER item_type POUR LES PRODUITS EXISTANTS ────────────────────────

UPDATE products p
  SET item_type = CASE
    WHEN s.shop_type = 'services'    THEN 'service'
    WHEN s.shop_type = 'memberships' THEN 'membership'
    ELSE 'product'
  END
FROM shops s
WHERE p.shop_id = s.id;

-- ─── 6. RLS SHOPS ─────────────────────────────────────────────────────────────

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les boutiques
DO $$ BEGIN
  CREATE POLICY "shops_select_all" ON shops FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un marchand ne peut insérer que sa propre boutique
DO $$ BEGIN
  CREATE POLICY "shops_insert_own" ON shops FOR INSERT
    WITH CHECK (merchant_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un marchand ne peut modifier que sa propre boutique
DO $$ BEGIN
  CREATE POLICY "shops_update_own" ON shops FOR UPDATE
    USING (merchant_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un marchand ne peut supprimer que sa propre boutique
DO $$ BEGIN
  CREATE POLICY "shops_delete_own" ON shops FOR DELETE
    USING (merchant_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. RLS PRODUCTS ──────────────────────────────────────────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "products_select_all" ON products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products_insert_own" ON products FOR INSERT
    WITH CHECK (shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products_update_own" ON products FOR UPDATE
    USING (shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "products_delete_own" ON products FOR DELETE
    USING (shop_id IN (SELECT id FROM shops WHERE merchant_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 8. INDEX ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS shops_subcategories_gin ON shops USING GIN (subcategories);
CREATE INDEX IF NOT EXISTS shops_shop_type_idx     ON shops (shop_type);

-- ─── 9. STORAGE BUCKETS ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('logos',    'logos',    true),
  ('products', 'products', true),
  ('covers',   'covers',   true),
  ('avatars',  'avatars',  true)
ON CONFLICT (id) DO NOTHING;

-- ─── 10. POLICIES STORAGE ─────────────────────────────────────────────────────

DO $$ BEGIN CREATE POLICY "logos_public_read"   ON storage.objects FOR SELECT TO public      USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_write"    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_update"   ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "logos_auth_delete"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "products_public_read"  ON storage.objects FOR SELECT TO public      USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_write"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "products_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'products');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "covers_public_read"  ON storage.objects FOR SELECT TO public      USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_write"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_update"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "covers_auth_delete"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- ─── 11. VUE EFFECTIVE SHOPS ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW shops_effective AS
  SELECT
    s.*,
    (
      s.is_vip = TRUE
      OR (s.vip_manual = TRUE AND (s.vip_manual_until IS NULL OR s.vip_manual_until > NOW()))
    ) AS is_effectively_vip,
    (
      s.featured_manual = TRUE
      AND (s.featured_manual_until IS NULL OR s.featured_manual_until > NOW())
    ) AS is_effectively_featured
  FROM shops s;

-- ─── 12. FONCTION RPC get_auth_email_by_phone ────────────────────────────────
-- Permet à l'app de retrouver l'email auth depuis le numéro de téléphone

CREATE OR REPLACE FUNCTION get_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT auth_email FROM profiles WHERE phone = p_phone LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_auth_email_by_phone(TEXT) TO anon, authenticated;

-- ─── 13. CORRIGER LES VALEURS PAR DÉFAUT (rating) ────────────────────────────
-- rating = 0 tant qu'il n'y a pas de vrais avis (reviews_count = 0)

UPDATE shops SET rating = 0 WHERE reviews_count = 0;

ALTER TABLE shops ALTER COLUMN rating SET DEFAULT 0;

-- ─── 14. RECHARGER LE SCHEMA CACHE POSTGREST ─────────────────────────────────

NOTIFY pgrst, 'reload schema';
