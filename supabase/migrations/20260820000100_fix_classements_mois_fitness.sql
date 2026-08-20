-- ===========================================================================
-- LASSI — Correction classements fitness (abonnements non comptabilisés)
-- ---------------------------------------------------------------------------
-- Problème 1 : calcul_classements_mois (20260820000000) avait supprimé le
--   UNION ALL fitness_abonnements_clients ET utilisait shop_id au lieu de
--   merchant_id comme prestataire_id dans la section Mondial.
-- Problème 2 : get_classement_live_sous_categorie ignorait aussi les abonnements.
-- Fix : restaure la version correcte + ajoute fitness au live RPC.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.calcul_classements_mois(
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

  -- ── Mondial (top 40) — orders + abonnements fitness ──────────────────────────
  DELETE FROM classements WHERE type = 'mondial' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
  WITH
  cmds_orders AS (
    SELECT o.shop_id, o.client_id
    FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
      AND o.client_id IS NOT NULL
  ),
  cmds_fitness AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL AND s.merchant_id IS NOT NULL
  ),
  cmds_all AS (
    SELECT shop_id, client_id FROM cmds_orders
    UNION ALL
    SELECT shop_id, client_id FROM cmds_fitness
  ),
  cmds_ranked AS (
    SELECT shop_id, client_id,
      ROW_NUMBER() OVER (PARTITION BY shop_id, client_id ORDER BY (SELECT NULL)) AS rn
    FROM cmds_all
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds FROM cmds_ranked WHERE rn <= 20 GROUP BY shop_id
  ),
  scores AS (
    SELECT
      s.merchant_id AS prestataire_id,
      s.name AS nom, s.logo_url AS img, s.rating, s.created_at AS shop_created,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + s.reviews_count        * 3
        + s.rating * SQRT(GREATEST(s.reviews_count, 0) + 1) * 2
      ) AS points
    FROM shops s LEFT JOIN cmds_valides cv ON cv.shop_id = s.id
    WHERE COALESCE(s.vip_exclu, FALSE) = FALSE AND s.merchant_id IS NOT NULL
  ),
  ranked AS (
    SELECT prestataire_id, nom, img, points, rating, shop_created,
      ROW_NUMBER() OVER (ORDER BY points DESC, rating DESC, shop_created ASC, prestataire_id ASC) AS rang
    FROM scores
  )
  SELECT 'mondial', NULL, v_periode, rang::INTEGER, points, nom, img, prestataire_id, TRUE
  FROM ranked WHERE rang <= 40;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Quartiers (top 20) — basé sur les CLIENTS (profiles.zone) ────────────────
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

  -- ── Top clients (top 100) — orders + abonnements fitness ─────────────────────
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
  client_fitness_c AS (
    SELECT fac.client_id, COUNT(*) AS nb_abo
    FROM fitness_abonnements_clients fac
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL
    GROUP BY fac.client_id
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
        (COALESCE(co.nb_cmds, 0) + COALESCE(cf.nb_abo, 0)) * 10
        + COALESCE(ca.nb_avis, 0) * 5
      )::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders_c  co ON co.client_id = p.id
    LEFT JOIN client_fitness_c cf ON cf.client_id = p.id
    LEFT JOIN client_avis_c    ca ON ca.author_id  = p.id
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

GRANT EXECUTE ON FUNCTION public.calcul_classements_mois(TEXT) TO service_role;

-- ── get_classement_live_sous_categorie — inclure abonnements fitness ─────────
-- La version précédente ne comptait que les orders. Les salles de sport avaient
-- toujours 0 pts dans la vue live → "Place disponible" dans le Top 3.

DROP FUNCTION IF EXISTS public.get_classement_live_sous_categorie(TEXT);

CREATE OR REPLACE FUNCTION public.get_classement_live_sous_categorie(
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
  cmds_orders AS (
    SELECT o.shop_id
    FROM orders o
    CROSS JOIN week_bounds wb
    WHERE o.status      = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= wb.week_start
      AND o.created_at <  wb.week_end
      AND o.client_id  IS NOT NULL
  ),
  cmds_fitness AS (
    SELECT s.id AS shop_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    CROSS JOIN week_bounds wb
    WHERE fac.date_achat        >= wb.week_start
      AND fac.date_achat        <  wb.week_end
      AND fac.payment_intent_id IS NOT NULL
      AND s.merchant_id         IS NOT NULL
  ),
  cmds_all AS (
    SELECT shop_id FROM cmds_orders
    UNION ALL
    SELECT shop_id FROM cmds_fitness
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_all
    GROUP BY shop_id
  ),
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat,
           s.merchant_id
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
      AND s.merchant_id IS NOT NULL
  ),
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat,
           s.merchant_id
    FROM shops s
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) = 0
      AND s.category IS NOT NULL AND s.category <> ''
      AND s.merchant_id IS NOT NULL
  ),
  shops_sc AS (
    SELECT * FROM shops_avec_sc
    UNION ALL
    SELECT * FROM shops_sans_sc
  ),
  scores AS (
    SELECT ss.merchant_id AS prestataire_id, ss.nom, ss.img, ss.rating,
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
    ROW_NUMBER() OVER (ORDER BY points DESC, rating DESC, prestataire_id ASC)::INTEGER,
    points,
    nom,
    img,
    prestataire_id
  FROM scores
  ORDER BY 1
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) TO anon, authenticated;

-- ── Recalcul immédiat du mois courant ─────────────────────────────────────────
DO $recalc$
DECLARE v_n INTEGER;
BEGIN
  SELECT calcul_classements_mois(TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')) INTO v_n;
  RAISE NOTICE '[lassi] classements mois recalculés (fitness restauré) : % lignes', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur recalcul: %', SQLERRM;
END $recalc$;

-- ── Recalcul VIP rankings (inclut abonnements fitness depuis 20260819030000) ──
DO $vip$
BEGIN
  PERFORM public.update_vip_rankings();
  RAISE NOTICE '[lassi] VIP rankings recalculés';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[lassi] VIP update_vip_rankings erreur: %', SQLERRM;
END $vip$;

NOTIFY pgrst, 'reload schema';
