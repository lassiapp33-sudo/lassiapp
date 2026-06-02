-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  LASSİ — Storage, Sécurité & Rate Limiting                         ║
-- ║  Coller dans : Supabase Dashboard → SQL Editor → New Query → Run   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 1 : STORAGE — Buckets et policies
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Créer les 3 buckets publics ──────────────────────────────────────────────
-- (si déjà créés via le Dashboard, ignorer les erreurs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos',    'logos',    true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('products', 'products', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('covers',   'covers',   true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars',  'avatars',  true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Lecture publique sur tous les buckets ────────────────────────────────────
CREATE POLICY "Lecture publique logos"    ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Lecture publique products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Lecture publique covers"   ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Lecture publique avatars"  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- ─── Upload produits : commerçant → uniquement pour sa propre boutique ────────
-- Format du chemin : products/{shop_id}/{filename}
CREATE POLICY "Upload produits propriétaire" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Modif produits propriétaire" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Suppr produits propriétaire" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

-- ─── Upload logos : commerçant → uniquement pour sa propre boutique ───────────
-- Format du chemin : logos/{shop_id}/{filename}
CREATE POLICY "Upload logos propriétaire" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Modif logos propriétaire" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

-- ─── Upload covers : même logique ─────────────────────────────────────────────
CREATE POLICY "Upload covers propriétaire" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM shops WHERE merchant_id = auth.uid()
    )
  );

-- ─── Upload avatars : chaque utilisateur pour son propre avatar ───────────────
-- Format du chemin : avatars/{user_id}/{filename}
CREATE POLICY "Upload avatar propriétaire" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Modif avatar propriétaire" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 2 : COLONNES MANQUANTES
-- ═══════════════════════════════════════════════════════════════════════

-- Ajouter emoji séparé de photo_url dans products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📦';

-- Ajouter logo_url et cover_url dans shops
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS logo_url  TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Ajouter avatar_url dans profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Ajouter push_token dans profiles (si pas encore fait)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 3 : RATE LIMITING
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action     TEXT        NOT NULL,    -- 'create_order', 'send_message', 'debt_relance', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes de vérification (rapide)
CREATE INDEX IF NOT EXISTS rate_limits_user_action_idx
  ON rate_limits (user_id, action, created_at DESC);

-- RLS : chaque utilisateur ne voit que ses propres rate limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_own" ON rate_limits
  FOR ALL USING (user_id = auth.uid());

-- Fonction de vérification du rate limit (appelée dans les Edge Functions)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action  TEXT,
  p_max     INT,         -- max actions autorisées
  p_window  INTERVAL     -- fenêtre de temps (ex: '1 hour')
)
RETURNS BOOLEAN          -- TRUE = autorisé, FALSE = bloqué
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  -- Nettoyer les anciennes entrées (> 24h) pour éviter la croissance infinie
  DELETE FROM rate_limits
  WHERE created_at < now() - INTERVAL '24 hours';

  -- Compter les actions récentes
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action   = p_action
    AND created_at >= now() - p_window;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  -- Enregistrer cette nouvelle action
  INSERT INTO rate_limits (user_id, action) VALUES (p_user_id, p_action);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INT, INTERVAL) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 4 : AUDIT RLS — requête de vérification
-- ═══════════════════════════════════════════════════════════════════════
-- Exécute cette requête pour voir quelles tables ont RLS activé :
/*
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
*/

-- Test d'isolation : vérifier qu'un user ne voit pas les données d'un autre
-- (remplacer les UUIDs par de vrais IDs de test)
/*
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "USER_A_UUID"}';

-- Ce SELECT ne doit retourner QUE les favoris de USER_A
SELECT * FROM favorites;

-- Ce SELECT ne doit retourner AUCUNE notification d'un autre user
SELECT * FROM notifications;
*/
