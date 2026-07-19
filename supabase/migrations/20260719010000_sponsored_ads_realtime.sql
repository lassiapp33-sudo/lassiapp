-- ============================================================
-- LASSI · Annonces Sponsorisées — Résultats temps réel
-- Migration 2026-07-19
-- ============================================================
-- Améliorations :
--   1. Colonne contact_count  : contacts initiés depuis l'annonce
--   2. RPC incrementer_contact_annonce
--   3. pg_cron : expiration automatique des annonces toutes les heures
--   4. Mise à jour get_sponsored_ads_actives avec contact_count
-- ============================================================

-- ─── 1. Colonne contact_count ─────────────────────────────────────────────────

ALTER TABLE sponsored_ads
  ADD COLUMN IF NOT EXISTS contact_count INTEGER NOT NULL DEFAULT 0;

-- ─── 2. RPC : incrémenter le compteur de contacts ────────────────────────────

DROP FUNCTION IF EXISTS incrementer_contact_annonce(UUID);
CREATE OR REPLACE FUNCTION incrementer_contact_annonce(p_ad_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sponsored_ads
  SET contact_count = contact_count + 1
  WHERE id = p_ad_id
    AND status = 'active'
    AND expires_at > now();
$$;

REVOKE EXECUTE ON FUNCTION incrementer_contact_annonce(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION incrementer_contact_annonce(UUID) TO authenticated;

-- ─── 3. RPC : expirer automatiquement les annonces échues ────────────────────

CREATE OR REPLACE FUNCTION expirer_annonces_sponsorisees()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE sponsored_ads
  SET status = 'completed'
  WHERE status = 'active'
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION expirer_annonces_sponsorisees() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION expirer_annonces_sponsorisees() TO service_role;

-- ─── 4. pg_cron : expiration toutes les heures ───────────────────────────────

SELECT cron.schedule(
  'lassi-expirer-annonces',
  '0 * * * *',
  'SELECT expirer_annonces_sponsorisees()'
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'lassi-expirer-annonces'
);

-- ─── 5. Mise à jour get_sponsored_ads_actives avec contact_count ─────────────

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
      sa.contact_count,
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
