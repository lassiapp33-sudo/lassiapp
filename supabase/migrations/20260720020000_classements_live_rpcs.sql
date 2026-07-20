-- ===========================================================================
-- Fix : get_classement_live_sous_categorie et get_classement_live_mondial
-- étaient appelés depuis classementService.ts mais n'existaient pas en base.
-- Ces RPCs calculent les points EN TEMPS RÉEL (semaine/mois courant) et
-- servent de fallback quand le snapshot pg_cron n'a pas encore tourné.
-- ===========================================================================

-- ─── 0. DROP des anciennes signatures (return type change interdit sans DROP) ──

DROP FUNCTION IF EXISTS get_classement_live_sous_categorie(TEXT);
DROP FUNCTION IF EXISTS get_classement_live_mondial();

-- ─── 1. Live sous-catégorie (semaine courante lundi → maintenant) ─────────────

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
      DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')  AS week_start,
      NOW() AT TIME ZONE 'UTC'                       AS week_end
  ),
  cmds_valides AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds
    FROM orders o
    CROSS JOIN week_bounds wb
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= wb.week_start
      AND o.created_at <  wb.week_end
      AND o.client_id IS NOT NULL
    GROUP BY o.shop_id
  ),
  -- Shops avec sous-catégories
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
  ),
  -- Shops sans sous-catégories → catégorie principale comme clé
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

-- ─── 2. Live mondial (mois courant 1er → maintenant) ─────────────────────────

CREATE OR REPLACE FUNCTION get_classement_live_mondial()
RETURNS TABLE(
  rang            INTEGER,
  points          NUMERIC,
  nom_affiche     TEXT,
  image_url       TEXT,
  prestataire_id  UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  month_bounds AS (
    SELECT
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')                      AS mois_start,
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' AS mois_end
  ),
  cmds_valides AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds
    FROM orders o
    CROSS JOIN month_bounds mb
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= mb.mois_start
      AND o.created_at <  mb.mois_end
      AND o.client_id IS NOT NULL
    GROUP BY o.shop_id
  ),
  scores AS (
    SELECT
      s.id         AS shop_id,
      s.name       AS nom,
      s.logo_url   AS img,
      s.rating,
      s.created_at AS shop_created,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + s.reviews_count        * 3
        + s.rating * SQRT(GREATEST(s.reviews_count, 0) + 1) * 2
      ) AS points
    FROM shops s
    LEFT JOIN cmds_valides cv ON cv.shop_id = s.id
    WHERE COALESCE(s.vip_exclu, FALSE) = FALSE
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY points DESC, rating DESC, shop_created ASC, shop_id ASC
    )::INTEGER,
    points,
    nom,
    img,
    shop_id
  FROM scores
  ORDER BY 1
  LIMIT 40;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_mondial() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_mondial() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
