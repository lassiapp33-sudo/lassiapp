-- ===========================================================================
-- LASSI — Fitness dans classements + RPC recette du jour fitness
-- ---------------------------------------------------------------------------
-- Problèmes corrigés :
--   1. calcul_classements_semaine/mois ignorait fitness_abonnements_clients
--      → les salles de sport avaient 0 pts même avec des abonnés payants
--   2. get_daily_fitness_earnings : recette du jour = montant reversé par LASSI
--      (payout_queue.montant = net après commission + frais OM)
--
-- Structure réelle table classements (pas de updated_at, prestataire_id → profiles.id)
-- Cf. migration 20260731040000_fix_classement_merchant_id.sql
-- ===========================================================================


-- ─── 1. calcul_classements_semaine — inclure les abonnements fitness ──────────

CREATE OR REPLACE FUNCTION public.calcul_classements_semaine(
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
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
  WITH

  -- Commandes classiques Wave/OM
  cmds_orders AS (
    SELECT o.shop_id, o.client_id
    FROM orders o
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_week_start
      AND o.created_at <  v_week_end
      AND o.client_id IS NOT NULL
  ),

  -- Abonnements fitness payés (payment_intent_id non null = paiement confirmé via OM/Wave)
  cmds_fitness AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat       >= v_week_start
      AND fac.date_achat        < v_week_end
      AND fac.payment_intent_id IS NOT NULL
      AND s.merchant_id IS NOT NULL
  ),

  -- Union : toutes les "transactions" de la semaine
  cmds_all AS (
    SELECT shop_id, client_id FROM cmds_orders
    UNION ALL
    SELECT shop_id, client_id FROM cmds_fitness
  ),

  -- Anti-triche : max 5 par client par shop par semaine
  cmds_ranked AS (
    SELECT shop_id, client_id,
      ROW_NUMBER() OVER (PARTITION BY shop_id, client_id ORDER BY (SELECT NULL)) AS rn
    FROM cmds_all
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_ranked WHERE rn <= 5
    GROUP BY shop_id
  ),

  -- Shops avec sous-catégories déclarées
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.merchant_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
      AND s.merchant_id IS NOT NULL
  ),
  -- Shops sans sous-catégories (fallback sur category)
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.merchant_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat
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
    SELECT ss.merchant_id AS prestataire_id, ss.sous_cat, ss.nom, ss.img, ss.rating,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10
        + ss.reviews_count       * 3
        + ss.rating              * 2
      ) AS points
    FROM shops_sc ss
    LEFT JOIN cmds_valides cv ON cv.shop_id = ss.shop_id
  ),

  ranked AS (
    SELECT prestataire_id, sous_cat, nom, img, points, rating,
      ROW_NUMBER() OVER (
        PARTITION BY sous_cat
        ORDER BY points DESC, rating DESC, prestataire_id ASC
      ) AS rang
    FROM scores
  )

  SELECT 'sous_categorie', sous_cat, v_periode, rang::INTEGER, points, nom, img, prestataire_id, TRUE
  FROM ranked WHERE rang <= 20;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcul_classements_semaine(TEXT) TO service_role;


-- ─── 2. calcul_classements_mois — inclure les abonnements fitness ─────────────

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

  -- ── Mondial (top 40) ─────────────────────────────────────────────────────────
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

  -- ── Quartiers (top 10) ────────────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'quartier' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
  WITH
  cmds_zone_orders AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
    GROUP BY o.shop_id
  ),
  cmds_zone_fitness AS (
    SELECT s.id AS shop_id, COUNT(*) AS nb_cmds
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL
    GROUP BY s.id
  ),
  zone_scores AS (
    SELECT
      COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné') AS zone,
      ROUND(
        SUM(COALESCE(co.nb_cmds, 0) + COALESCE(cf.nb_cmds, 0)) * 10
        + SUM(s.reviews_count) * 3
        + SUM(s.rating)        * 2
      ) AS points
    FROM shops s
    LEFT JOIN cmds_zone_orders  co ON co.shop_id = s.id
    LEFT JOIN cmds_zone_fitness cf ON cf.shop_id = s.id
    GROUP BY COALESCE(NULLIF(TRIM(COALESCE(s.zone, '')), ''), 'Non renseigné')
    HAVING ROUND(
      SUM(COALESCE(co.nb_cmds, 0) + COALESCE(cf.nb_cmds, 0)) * 10
      + SUM(s.reviews_count) * 3 + SUM(s.rating) * 2
    ) > 0
  ),
  ranked_q AS (
    SELECT zone, points, ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC) AS rang
    FROM zone_scores
  )
  SELECT 'quartier', NULL, v_periode, rang::INTEGER, points, zone, NULL, NULL, TRUE
  FROM ranked_q WHERE rang <= 10;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── Top clients (top 10) ──────────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif)
  WITH
  client_orders AS (
    SELECT client_id, COUNT(*) AS nb_cmds FROM orders
    WHERE status = 'done' AND created_at >= v_mois_start AND created_at < v_mois_end
      AND client_id IS NOT NULL
    GROUP BY client_id
  ),
  client_fitness AS (
    SELECT fac.client_id, COUNT(*) AS nb_abo
    FROM fitness_abonnements_clients fac
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL
    GROUP BY fac.client_id
  ),
  client_avis AS (
    SELECT author_id, COUNT(*) AS nb_avis FROM avis
    WHERE NOT masque AND created_at >= v_mois_start AND created_at < v_mois_end
    GROUP BY author_id
  ),
  scores_c AS (
    SELECT p.id AS client_id, p.name AS nom, p.avatar_url AS img,
      ROUND(
        (COALESCE(co.nb_cmds, 0) + COALESCE(cf.nb_abo, 0)) * 10
        + COALESCE(ca.nb_avis, 0) * 5
      ) AS points
    FROM profiles p
    LEFT JOIN client_orders  co ON co.client_id = p.id
    LEFT JOIN client_fitness cf ON cf.client_id = p.id
    LEFT JOIN client_avis    ca ON ca.author_id = p.id
    WHERE COALESCE(co.nb_cmds, 0) + COALESCE(cf.nb_abo, 0) > 0
  ),
  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )
  SELECT 'client', NULL, v_periode, rang::INTEGER, points, nom, img, client_id, TRUE
  FROM ranked_c WHERE rang <= 10;
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcul_classements_mois(TEXT) TO service_role;


-- ─── 3. RPC recette du jour fitness ──────────────────────────────────────────
-- Retourne la somme des montants RÉELLEMENT reversés par LASSI aujourd'hui
-- (payout_queue.montant = montant net après commission + frais OM/Wave)
-- Uniquement pour les abonnements fitness (metadata->>'offre_nom' non null)

CREATE OR REPLACE FUNCTION public.get_daily_fitness_earnings(
  p_prestataire_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today   TIMESTAMPTZ;
  v_revenue INTEGER;
  v_count   INTEGER;
BEGIN
  v_today := date_trunc('day', NOW() AT TIME ZONE 'UTC');

  SELECT
    COALESCE(SUM(pq.montant), 0)::INTEGER,
    COUNT(*)::INTEGER
  INTO v_revenue, v_count
  FROM public.payout_queue pq
  JOIN public.payment_intents pi ON pi.id = pq.payment_intent_id
  WHERE pq.prestataire_id = p_prestataire_id
    AND pq.statut         = 'paid'
    AND pq.processed_at  >= v_today
    AND (pi.metadata ->> 'offre_nom') IS NOT NULL;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'count',   v_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_fitness_earnings(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_daily_fitness_earnings(UUID) TO authenticated, service_role;


-- ─── 4. Recalcul immédiat des classements ────────────────────────────────────

DO $$
DECLARE v_n INTEGER;
BEGIN
  SELECT public.calcul_classements_semaine() INTO v_n;
  RAISE NOTICE '[lassi] classements semaine recalculés : % lignes', v_n;

  SELECT public.calcul_classements_mois() INTO v_n;
  RAISE NOTICE '[lassi] classements mois recalculés : % lignes', v_n;
END;
$$;

NOTIFY pgrst, 'reload schema';
