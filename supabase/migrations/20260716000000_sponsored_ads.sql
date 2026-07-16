-- ============================================================
-- LASSI · Annonces Sponsorisées (Pack Visibilité — Option 1)
-- Migration 2026-07-16
-- ============================================================
-- Système de campagnes publicitaires payées en crédits LASSI.
-- Les prestataires créent des annonces (Format A Classique ou Format B Affiche)
-- qui apparaissent dans le feed des clients pendant la durée achetée.
--
-- Tables :
--   - sponsored_ads       : campagnes actives/terminées
--
-- RPC :
--   - creer_annonce_sponsorisee()  : crée + débite le crédit (SECURITY DEFINER)
--   - get_sponsored_ads_actives()  : feed client (SECURITY DEFINER)
--   - incrementer_vue_annonce()    : compteur de vues (SECURITY DEFINER)
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsored_ads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  merchant_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Format d'affichage
  format               TEXT NOT NULL DEFAULT 'classique'
                         CHECK (format IN ('classique', 'affiche')),

  -- Contenu (titre/corps pour Format A ; image_url obligatoire pour Format B)
  titre                TEXT,
  corps                TEXT,
  image_url            TEXT,

  -- Budget et durée de campagne
  budget_credits       INTEGER NOT NULL CHECK (budget_credits > 0),
  duration_hours       INTEGER NOT NULL CHECK (duration_hours > 0),

  -- Portée estimée calculée au moment de la création
  estimated_views_min  INTEGER NOT NULL DEFAULT 0,
  estimated_views_max  INTEGER NOT NULL DEFAULT 0,

  -- Compteur de vues réelles (incrémenté via RPC)
  actual_views         INTEGER NOT NULL DEFAULT 0,

  -- Cycle de vie
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_ads_active   ON sponsored_ads(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_shop     ON sponsored_ads(shop_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_merchant ON sponsored_ads(merchant_id);

ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;

-- Prestataire lit uniquement ses propres annonces
DROP POLICY IF EXISTS "sponsored_ads_merchant_read" ON sponsored_ads;
CREATE POLICY "sponsored_ads_merchant_read" ON sponsored_ads
  FOR SELECT USING (merchant_id = auth.uid());

-- Clients lisent les annonces actives non expirées (feed public)
DROP POLICY IF EXISTS "sponsored_ads_client_feed" ON sponsored_ads;
CREATE POLICY "sponsored_ads_client_feed" ON sponsored_ads
  FOR SELECT USING (
    status = 'active'
    AND expires_at > now()
    AND auth.role() = 'authenticated'
  );

-- Admins ont accès complet
DROP POLICY IF EXISTS "sponsored_ads_admin_all" ON sponsored_ads;
CREATE POLICY "sponsored_ads_admin_all" ON sponsored_ads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================
-- RPC : créer une annonce — débite le crédit et insère la ligne
-- SECURITY DEFINER pour contourner la RLS sur shops (UPDATE)
-- ============================================================
DROP FUNCTION IF EXISTS creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION creer_annonce_sponsorisee(
  p_shop_id        UUID,
  p_format         TEXT,
  p_titre          TEXT,
  p_corps          TEXT,
  p_image_url      TEXT,
  p_budget_credits INTEGER,
  p_duration_hours INTEGER,
  p_est_min        INTEGER,
  p_est_max        INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id UUID;
  v_balance     INTEGER;
  v_expires_at  TIMESTAMPTZ;
  v_ad_id       UUID;
BEGIN
  -- Vérifier que l'appelant est bien le propriétaire du shop
  SELECT merchant_id INTO v_merchant_id
  FROM shops WHERE id = p_shop_id;

  IF v_merchant_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validation du format
  IF p_format NOT IN ('classique', 'affiche') THEN
    RAISE EXCEPTION 'format_invalide';
  END IF;

  -- Vérifier le solde de crédit
  SELECT credit_balance INTO v_balance
  FROM shops WHERE id = p_shop_id;

  IF COALESCE(v_balance, 0) < p_budget_credits THEN
    RAISE EXCEPTION 'credit_insuffisant: % disponibles, % requis', COALESCE(v_balance, 0), p_budget_credits;
  END IF;

  -- Déduire le crédit
  UPDATE shops
  SET credit_balance = credit_balance - p_budget_credits
  WHERE id = p_shop_id;

  -- Calculer la date d'expiration
  v_expires_at := now() + (p_duration_hours || ' hours')::INTERVAL;

  -- Insérer l'annonce
  INSERT INTO sponsored_ads (
    shop_id, merchant_id, format, titre, corps, image_url,
    budget_credits, duration_hours,
    estimated_views_min, estimated_views_max,
    expires_at
  ) VALUES (
    p_shop_id, v_merchant_id, p_format, p_titre, p_corps, p_image_url,
    p_budget_credits, p_duration_hours,
    p_est_min, p_est_max,
    v_expires_at
  )
  RETURNING id INTO v_ad_id;

  RETURN json_build_object(
    'id',          v_ad_id,
    'expires_at',  v_expires_at,
    'new_balance', v_balance - p_budget_credits
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

-- ============================================================
-- RPC : annonces actives pour le feed client (avec infos boutique)
-- ============================================================
DROP FUNCTION IF EXISTS get_sponsored_ads_actives(INTEGER);
CREATE OR REPLACE FUNCTION get_sponsored_ads_actives(p_limit INTEGER DEFAULT 5)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      sa.id,
      sa.format,
      sa.titre,
      sa.corps,
      sa.image_url,
      sa.estimated_views_min,
      sa.estimated_views_max,
      sa.actual_views,
      sa.expires_at,
      sa.shop_id,
      s.name        AS shop_name,
      s.category    AS shop_category,
      s.logo_url    AS shop_logo_url
    FROM sponsored_ads sa
    JOIN shops s ON s.id = sa.shop_id
    WHERE sa.status = 'active'
      AND sa.expires_at > now()
    ORDER BY sa.budget_credits DESC, sa.created_at DESC
    LIMIT p_limit
  ) t
$$;

REVOKE EXECUTE ON FUNCTION get_sponsored_ads_actives(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_sponsored_ads_actives(INTEGER) TO authenticated;

-- ============================================================
-- RPC : incrémenter le compteur de vues (fire-and-forget côté client)
-- ============================================================
DROP FUNCTION IF EXISTS incrementer_vue_annonce(UUID);
CREATE OR REPLACE FUNCTION incrementer_vue_annonce(p_ad_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sponsored_ads
  SET actual_views = actual_views + 1
  WHERE id = p_ad_id
    AND status = 'active'
    AND expires_at > now();
$$;

REVOKE EXECUTE ON FUNCTION incrementer_vue_annonce(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION incrementer_vue_annonce(UUID) TO authenticated;
