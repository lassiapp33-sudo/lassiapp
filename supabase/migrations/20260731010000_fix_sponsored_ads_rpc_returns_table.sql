-- ============================================================
-- Fix : get_sponsored_ads_actives — RETURNS JSON → RETURNS TABLE
-- RETURNS JSON avec json_agg(row_to_json(t)) est enveloppé par
-- PostgREST en [{"coalesce": [...]}], ce qui rend ad.id = undefined
-- côté client → incrementerVue(undefined) échoue silencieusement
-- → les stats "vues" et "voir vitrine" restent à 0.
-- RETURNS TABLE retourne des lignes normales, bien supporté par PostgREST.
-- ============================================================

DROP FUNCTION IF EXISTS get_sponsored_ads_actives(INTEGER);

CREATE OR REPLACE FUNCTION get_sponsored_ads_actives(p_limit INTEGER DEFAULT 5)
RETURNS TABLE(
  id                  UUID,
  format              TEXT,
  titre               TEXT,
  corps               TEXT,
  image_url           TEXT,
  estimated_views_min INTEGER,
  estimated_views_max INTEGER,
  actual_views        INTEGER,
  contact_count       INTEGER,
  expires_at          TIMESTAMPTZ,
  shop_id             UUID,
  shop_name           TEXT,
  shop_category       TEXT,
  shop_logo_url       TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION get_sponsored_ads_actives(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_sponsored_ads_actives(INTEGER) TO authenticated;
