-- ===========================================================================
-- Fix P4 : get_classement_live_sous_categorie n'avait pas l'anti-triche
-- rn_client <= 5 (max 5 commandes comptées par client par shop par semaine),
-- ce qui créait une divergence de score entre live et snapshot pg_cron.
-- ===========================================================================

DROP FUNCTION IF EXISTS get_classement_live_sous_categorie(TEXT);

CREATE OR REPLACE FUNCTION get_classement_live_sous_categorie(
  p_sous_categorie TEXT
)
RETURNS TABLE(
  rang            INTEGER,
  points          NUMERIC,
  nom_affiche     TEXT,
  image_url       TEXT,
  prestataire_id  UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  week_bounds AS (
    SELECT
      DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') AS week_start,
      NOW() AT TIME ZONE 'UTC'                      AS week_end
  ),
  -- Anti-triche identique à calcul_classements_semaine : max 5 cmds/client/shop
  cmds_brutes AS (
    SELECT
      o.shop_id,
      o.client_id,
      ROW_NUMBER() OVER (
        PARTITION BY o.shop_id, o.client_id
        ORDER BY o.created_at
      ) AS rn_client
    FROM orders o
    CROSS JOIN week_bounds wb
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= wb.week_start
      AND o.created_at <  wb.week_end
      AND o.client_id IS NOT NULL
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_brutes
    WHERE rn_client <= 5
    GROUP BY shop_id
  ),
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
  ),
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat
    FROM shops s
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) = 0
      AND s.category IS NOT NULL AND s.category <> ''
  ),
  shops_sc AS (
    SELECT * FROM shops_avec_sc
    UNION ALL
    SELECT * FROM shops_sans_sc
  ),
  scores AS (
    SELECT ss.shop_id, ss.nom, ss.img, ss.rating,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + ss.reviews_count       * 3
        + ss.rating              * 2
      ) AS points
    FROM shops_sc ss
    LEFT JOIN cmds_valides cv ON cv.shop_id = ss.shop_id
    WHERE ss.sous_cat = p_sous_categorie
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY points DESC, rating DESC, shop_id ASC)::INTEGER,
    points,
    nom,
    img,
    shop_id
  FROM scores
  ORDER BY 1
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_sous_categorie(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_sous_categorie(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
