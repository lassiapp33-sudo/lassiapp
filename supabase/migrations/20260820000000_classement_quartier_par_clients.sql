-- ===========================================================================
-- LASSI — Classement quartier basé sur les clients (profiles.zone)
-- ---------------------------------------------------------------------------
-- Avant : classement quartier = activité des boutiques (shops.zone).
--         Un quartier n'apparaissait que si un marchand y avait de l'activité.
-- Après : classement quartier = zones des CLIENTS inscrits (profiles.zone).
--         Dès qu'un client s'inscrit dans un quartier → il apparaît à 0 pts.
--         Les points montent au fil des commandes et avis du mois.
-- ===========================================================================

-- ── 1. Colonne zone dans profiles ────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zone TEXT;

-- ── 2. RPC live quartiers — basée sur clients ─────────────────────────────────
DROP FUNCTION IF EXISTS get_classement_live_quartiers();

CREATE OR REPLACE FUNCTION get_classement_live_quartiers()
RETURNS TABLE(
  rang        INTEGER,
  points      NUMERIC,
  nom_affiche TEXT,
  image_url   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  mb AS (
    SELECT
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')                      AS mois_start,
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month' AS mois_end
  ),
  client_orders AS (
    SELECT p.zone, COUNT(*) AS nb_cmds
    FROM orders o
    JOIN profiles p ON p.id = o.client_id
    CROSS JOIN mb
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= mb.mois_start
      AND o.created_at <  mb.mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  client_avis AS (
    SELECT p.zone, COUNT(*) AS nb_avis
    FROM avis a
    JOIN profiles p ON p.id = a.author_id
    CROSS JOIN mb
    WHERE NOT a.masque
      AND a.created_at >= mb.mois_start
      AND a.created_at <  mb.mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  zone_scores AS (
    SELECT
      p.zone,
      SUM(
        COALESCE(co.nb_cmds, 0) * 10
        + COALESCE(ca.nb_avis,  0) * 5
      ) AS points
    FROM profiles p
    LEFT JOIN client_orders co ON co.zone = p.zone
    LEFT JOIN client_avis   ca ON ca.zone = p.zone
    WHERE p.role = 'client'
      AND p.zone IS NOT NULL
      AND TRIM(p.zone) != ''
    GROUP BY p.zone
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC)::INTEGER,
    points::NUMERIC,
    zone,
    NULL::TEXT
  FROM zone_scores
  ORDER BY 1
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_quartiers() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_quartiers() TO anon, authenticated;

-- ── 3. calcul_classements_mois — section quartiers refaite sur clients ────────
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
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
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
  SELECT 'mondial', NULL, v_periode, rang::INTEGER, points, nom, img, shop_id, TRUE
  FROM ranked WHERE rang <= 40;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Quartiers (top 20) — basé sur clients (profiles.zone) ───────────────────
  DELETE FROM classements WHERE type = 'quartier' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
  WITH
  client_orders AS (
    SELECT p.zone, COUNT(*) AS nb_cmds
    FROM orders o
    JOIN profiles p ON p.id = o.client_id
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  client_avis AS (
    SELECT p.zone, COUNT(*) AS nb_avis
    FROM avis a
    JOIN profiles p ON p.id = a.author_id
    WHERE NOT a.masque
      AND a.created_at >= v_mois_start AND a.created_at < v_mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  zone_scores AS (
    SELECT
      p.zone,
      SUM(
        COALESCE(co.nb_cmds, 0) * 10
        + COALESCE(ca.nb_avis,  0) * 5
      )::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders co ON co.zone = p.zone
    LEFT JOIN client_avis   ca ON ca.zone = p.zone
    WHERE p.role = 'client'
      AND p.zone IS NOT NULL
      AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  ranked_q AS (
    SELECT zone, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC) AS rang
    FROM zone_scores
  )
  SELECT 'quartier', NULL, v_periode, rang::INTEGER, points, zone, NULL, NULL, TRUE
  FROM ranked_q WHERE rang <= 20;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Top clients (top 100) — TOUS les clients, même 0 pts ────────────────────
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif)
  WITH
  client_orders_c AS (
    SELECT client_id, COUNT(*) AS nb_cmds FROM orders
    WHERE status = 'done'
      AND created_at >= v_mois_start AND created_at < v_mois_end
      AND client_id IS NOT NULL
    GROUP BY client_id
  ),
  client_avis_c AS (
    SELECT author_id, COUNT(*) AS nb_avis FROM avis
    WHERE NOT masque
      AND created_at >= v_mois_start AND created_at < v_mois_end
    GROUP BY author_id
  ),
  scores_c AS (
    SELECT
      p.id         AS client_id,
      p.name       AS nom,
      p.avatar_url AS img,
      (
        COALESCE(co.nb_cmds, 0) * 10
        + COALESCE(ca.nb_avis,  0) * 5
      )::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders_c co ON co.client_id = p.id
    LEFT JOIN client_avis_c   ca ON ca.author_id  = p.id
    WHERE p.role = 'client'
  ),
  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )
  SELECT 'client', NULL, v_periode, rang::INTEGER, points, COALESCE(nom, '?'), img, client_id, TRUE
  FROM ranked_c WHERE rang <= 100;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  RETURN v_updated;
END;
$$;

-- ── 4. Recalcul immédiat du mois courant ─────────────────────────────────────
DO $recalc$
DECLARE v_n INTEGER;
BEGIN
  SELECT calcul_classements_mois(TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')) INTO v_n;
  RAISE NOTICE 'Classements recalculés (quartier→clients) : % lignes', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur recalcul: %', SQLERRM;
END $recalc$;

NOTIFY pgrst, 'reload schema';
