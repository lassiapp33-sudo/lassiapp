-- ===========================================================================
-- FIX : get_classement_live_quartiers — RPC fallback live (sans classements)
-- Calcule les points quartiers en temps réel depuis orders + shops.
-- Appelé par classementService.ts quand aucun snapshot pg_cron n'existe.
-- NB : ne touche pas la table classements (pas de FK / updated_at issue).
-- ===========================================================================

DROP FUNCTION IF EXISTS get_classement_live_quartiers();

CREATE OR REPLACE FUNCTION get_classement_live_quartiers()
RETURNS TABLE(
  rang         INTEGER,
  points       NUMERIC,
  nom_affiche  TEXT,
  image_url    TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  month_bounds AS (
    SELECT
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')                       AS mois_start,
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'  AS mois_end
  ),
  cmds_zone AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds
    FROM orders o
    CROSS JOIN month_bounds mb
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= mb.mois_start
      AND o.created_at <  mb.mois_end
    GROUP BY o.shop_id
  ),
  zone_scores AS (
    SELECT
      COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné') AS zone,
      ROUND(
        SUM(COALESCE(c.nb_cmds, 0)) * 10
        + SUM(s.reviews_count)       * 3
        + SUM(s.rating)              * 2
      ) AS points
    FROM shops s
    LEFT JOIN cmds_zone c ON c.shop_id = s.id
    GROUP BY COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné')
    HAVING ROUND(
      SUM(COALESCE(c.nb_cmds, 0)) * 10
      + SUM(s.reviews_count)       * 3
      + SUM(s.rating)              * 2
    ) > 0
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC)::INTEGER,
    points,
    zone,
    NULL::TEXT
  FROM zone_scores
  ORDER BY 1
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_quartiers() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_quartiers() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
