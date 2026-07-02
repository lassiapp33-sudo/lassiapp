-- ===========================================================================
-- LASSI — Classements : tous les prestataires dès la création du compte
-- 1. sous_catégorie : les shops sans subcategories utilisent leur category
-- 2. quartier : les shops sans zone apparaissent sous 'Non renseigné'
-- ===========================================================================

-- ─── 1. Mise à jour calcul_classements_semaine ───────────────────────────────
-- Avant : WHERE jsonb_array_length(subcategories) > 0  → excluait les nouveaux
-- Après : UNION ALL avec shops.category comme sous_cat pour ceux sans subcat

CREATE OR REPLACE FUNCTION calcul_classements_semaine(
  p_periode TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_periode    TEXT;
  v_week_start TIMESTAMPTZ;
  v_week_end   TIMESTAMPTZ;
  v_updated    INTEGER;
BEGIN
  v_periode    := COALESCE(p_periode, current_iso_week());
  v_week_start := (TO_DATE(REPLACE(v_periode, '-S', '-'), 'IYYY-IW')::TIMESTAMP) AT TIME ZONE 'UTC';
  v_week_end   := v_week_start + INTERVAL '7 days';

  DELETE FROM classements WHERE type = 'sous_categorie' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH

  cmds_brutes AS (
    SELECT o.shop_id, o.client_id,
      ROW_NUMBER() OVER (PARTITION BY o.shop_id, o.client_id ORDER BY o.created_at) AS rn_client
    FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_week_start AND o.created_at < v_week_end
      AND o.client_id IS NOT NULL
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds FROM cmds_brutes
    WHERE rn_client <= 5 GROUP BY shop_id
  ),

  -- Shops AVEC sous-catégories → une ligne par sous-catégorie
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
  ),

  -- Shops SANS sous-catégories → clé = catégorie principale (resto, hair, sport…)
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
    SELECT ss.shop_id, ss.sous_cat, ss.nom, ss.img, ss.rating,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + ss.reviews_count       * 3
        + ss.rating              * 2
      ) AS points
    FROM shops_sc ss LEFT JOIN cmds_valides cv ON cv.shop_id = ss.shop_id
  ),

  ranked AS (
    SELECT shop_id, sous_cat, nom, img, points, rating,
      ROW_NUMBER() OVER (
        PARTITION BY sous_cat
        ORDER BY points DESC, rating DESC, shop_id ASC
      ) AS rang
    FROM scores
  )

  SELECT 'sous_categorie', sous_cat, v_periode, rang::INTEGER, points, nom, img, shop_id, TRUE, NOW()
  FROM ranked WHERE rang <= 20;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ─── 2. Mise à jour calcul_classements_mois (section quartiers) ──────────────
-- Avant : WHERE s.zone IS NOT NULL AND TRIM(s.zone) <> ''  → excluait sans zone
-- Après : COALESCE(NULLIF(TRIM(s.zone),''), 'Non renseigné') → tous inclus

CREATE OR REPLACE FUNCTION calcul_classements_mois(
  p_periode TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_periode    TEXT;
  v_mois_start TIMESTAMPTZ;
  v_mois_end   TIMESTAMPTZ;
  v_updated    INTEGER := 0;
  v_partial    INTEGER;
BEGIN
  v_periode    := COALESCE(p_periode, TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'));
  v_mois_start := ((v_periode || '-01')::DATE::TIMESTAMP) AT TIME ZONE 'UTC';
  v_mois_end   := v_mois_start + INTERVAL '1 month';

  -- ── Mondial (top 40) ─────────────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'mondial' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH
  cmds_brutes AS (
    SELECT o.shop_id, o.client_id,
      ROW_NUMBER() OVER (PARTITION BY o.shop_id, o.client_id ORDER BY o.created_at) AS rn_client
    FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
      AND o.client_id IS NOT NULL
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds FROM cmds_brutes
    WHERE rn_client <= 20 GROUP BY shop_id
  ),
  scores AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.created_at AS shop_created,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + s.reviews_count        * 3
        + s.rating * SQRT(GREATEST(s.reviews_count, 0) + 1) * 2
      ) AS points
    FROM shops s LEFT JOIN cmds_valides cv ON cv.shop_id = s.id
    WHERE COALESCE(s.vip_exclu, FALSE) = FALSE
  ),
  ranked AS (
    SELECT shop_id, nom, img, points, rating, shop_created,
      ROW_NUMBER() OVER (ORDER BY points DESC, rating DESC, shop_created ASC, shop_id ASC) AS rang
    FROM scores
  )
  SELECT 'mondial', NULL, v_periode, rang::INTEGER, points, nom, img, shop_id, TRUE, NOW()
  FROM ranked WHERE rang <= 40;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Quartiers (top 10) — tous les shops, zone 'Non renseigné' si absente ────
  DELETE FROM classements WHERE type = 'quartier' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH
  cmds_zone AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
    GROUP BY o.shop_id
  ),
  zone_scores AS (
    SELECT
      COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné') AS zone,
      ROUND(SUM(COALESCE(c.nb_cmds, 0)) * 10 + SUM(s.reviews_count) * 3 + SUM(s.rating) * 2) AS points
    FROM shops s LEFT JOIN cmds_zone c ON c.shop_id = s.id
    GROUP BY COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné')
  ),
  ranked_q AS (
    SELECT zone, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC) AS rang
    FROM zone_scores
  )
  SELECT 'quartier', NULL, v_periode, rang::INTEGER, points, zone, NULL, NULL, TRUE, NOW()
  FROM ranked_q WHERE rang <= 10;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Top clients (top 10) ─────────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif, updated_at)
  WITH
  client_orders AS (
    SELECT client_id, COUNT(*) AS nb_cmds FROM orders
    WHERE status = 'done' AND created_at >= v_mois_start AND created_at < v_mois_end
      AND client_id IS NOT NULL
    GROUP BY client_id
  ),
  client_avis AS (
    SELECT author_id, COUNT(*) AS nb_avis FROM avis
    WHERE NOT masque AND created_at >= v_mois_start AND created_at < v_mois_end
    GROUP BY author_id
  ),
  scores_c AS (
    SELECT p.id AS client_id, p.name AS nom, p.avatar_url AS img,
      ROUND(COALESCE(co.nb_cmds, 0) * 10 + COALESCE(ca.nb_avis, 0) * 5) AS points
    FROM profiles p
    JOIN client_orders co ON co.client_id = p.id
    LEFT JOIN client_avis ca ON ca.author_id = p.id
  ),
  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )
  SELECT 'client', NULL, v_periode, rang::INTEGER, points, nom, img, client_id, TRUE, NOW()
  FROM ranked_c WHERE rang <= 10;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  RETURN v_updated;
END;
$$;

-- ─── 3. Recalcul immédiat avec les nouvelles fonctions ───────────────────────

DO $init$
DECLARE
  v_current_week  TEXT;
  v_previous_week TEXT;
  v_current_month TEXT;
  v_n             INTEGER;
BEGIN
  v_current_week  := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY"-S"IW');
  v_previous_week := TO_CHAR(NOW() AT TIME ZONE 'UTC' - INTERVAL '7 days', 'IYYY"-S"IW');
  v_current_month := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');

  SELECT calcul_classements_semaine(v_current_week)  INTO v_n;
  RAISE NOTICE 'sous_categorie % : % lignes', v_current_week, v_n;

  IF v_previous_week <> v_current_week THEN
    SELECT calcul_classements_semaine(v_previous_week) INTO v_n;
    RAISE NOTICE 'sous_categorie % : % lignes', v_previous_week, v_n;
  END IF;

  SELECT calcul_classements_mois(v_current_month) INTO v_n;
  RAISE NOTICE 'mensuel % : % lignes', v_current_month, v_n;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur: %', SQLERRM;
END $init$;

NOTIFY pgrst, 'reload schema';
