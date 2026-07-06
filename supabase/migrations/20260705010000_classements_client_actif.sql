-- ===========================================================================
-- LASSI — Classement clients actif dès la création du compte
-- ---------------------------------------------------------------------------
-- Fix 1 : calcul_classements_mois → LEFT JOIN clients (0 pts inclus), limit 100
-- Fix 2 : get_classement_live_clients → limit 100 (au lieu de 10)
-- Fix 3 : get_classement_live_quartiers → RPC live (onglet Mon quartier)
-- Fix 4 : Recalcul immédiat pour peupler la table classements
-- ===========================================================================

-- ─── 1. Mettre à jour calcul_classements_mois (section Top clients) ──────────
-- Avant : JOIN client_orders (uniquement clients avec commandes)
-- Après : LEFT JOIN + WHERE role='client' → tous les clients, même 0 pts

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

  -- ── Quartiers (top 10) ───────────────────────────────────────────────────────
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

  -- ── Top clients (top 100) — TOUS les clients dès la création du compte ───────
  -- LEFT JOIN : les clients sans commande apparaissent avec 0 pts
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif, updated_at)
  WITH
  client_orders AS (
    SELECT client_id, COUNT(*) AS nb_cmds FROM orders
    WHERE status = 'done'
      AND created_at >= v_mois_start AND created_at < v_mois_end
      AND client_id IS NOT NULL
    GROUP BY client_id
  ),
  client_avis AS (
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
      ROUND(
        COALESCE(co.nb_cmds, 0) * 10
        + COALESCE(ca.nb_avis,  0) * 5
      ) AS points
    FROM profiles p
    LEFT JOIN client_orders co ON co.client_id = p.id
    LEFT JOIN client_avis   ca ON ca.author_id  = p.id
    WHERE p.role = 'client'
  ),
  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )
  SELECT 'client', NULL, v_periode, rang::INTEGER, points, nom, img, client_id, TRUE, NOW()
  FROM ranked_c WHERE rang <= 100;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  RETURN v_updated;
END;
$$;

-- ─── 2. RPC live quartiers ────────────────────────────────────────────────────
-- Fallback utilisé quand le snapshot pg_cron n'a pas encore tourné.

CREATE OR REPLACE FUNCTION get_classement_live_quartiers()
RETURNS TABLE(
  rang        INTEGER,
  points      NUMERIC,
  nom_affiche TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cmds_zone AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds
    FROM orders o
    WHERE o.status = 'done'
      AND o.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      AND o.created_at <  date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'
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
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC)::INTEGER AS rang,
    points,
    zone AS nom_affiche
  FROM zone_scores
  ORDER BY points DESC, zone ASC
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_quartiers() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_quartiers() TO anon, authenticated;

-- ─── 3. Agrandir get_classement_live_clients de 10 → 100 ─────────────────────

CREATE OR REPLACE FUNCTION get_classement_live_clients()
RETURNS TABLE(
  client_id   UUID,
  rang        INTEGER,
  points      INTEGER,
  nom_affiche TEXT,
  image_url   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cs.client_id,
    ROW_NUMBER() OVER (ORDER BY cs.points_mois DESC, cs.updated_at ASC)::INTEGER AS rang,
    cs.points_mois AS points,
    COALESCE(p.name, '?') AS nom_affiche,
    p.avatar_url          AS image_url
  FROM client_scores cs
  JOIN profiles p ON p.id = cs.client_id
  ORDER BY cs.points_mois DESC, cs.updated_at ASC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_clients() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_clients() TO anon, authenticated;

-- ─── 4. Recalcul immédiat ─────────────────────────────────────────────────────

DO $init$
DECLARE
  v_periode TEXT;
  v_n       INTEGER;
BEGIN
  v_periode := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
  SELECT calcul_classements_mois(v_periode) INTO v_n;
  RAISE NOTICE 'Classements mois % recalculés : % lignes', v_periode, v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur recalcul : %', SQLERRM;
END $init$;

NOTIFY pgrst, 'reload schema';
