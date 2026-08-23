-- ===========================================================================
-- LASSI — Fix classement : UNION → UNION ALL
-- ---------------------------------------------------------------------------
-- Bug : cmds_all utilisait UNION (déduplique par shop_id).
--   Un prestataire avec des commandes régulières ET un abonnement fitness
--   dans la même semaine → UNION gardait 1 seule ligne par shop_id
--   → nb_cmds = 1 quel que soit le nombre d'achats → score figé.
--
-- Fix : UNION ALL → chaque achat (commande ou abonnement) est compté
--   séparément. Le score reflète le nombre réel de transactions.
-- ===========================================================================


-- ── 1. get_classement_live_sous_categorie ────────────────────────────────────

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
      DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') + INTERVAL '7 days' AS week_end
  ),
  cmds_orders AS (
    SELECT o.shop_id
    FROM orders o CROSS JOIN week_bounds wb
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= wb.week_start AND o.created_at < wb.week_end
      AND o.client_id IS NOT NULL
  ),
  cmds_fitness AS (
    SELECT s.id AS shop_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    CROSS JOIN week_bounds wb
    WHERE fac.date_achat >= wb.week_start
      AND fac.date_achat <  wb.week_end
      AND fac.statut = 'actif'
      AND s.merchant_id IS NOT NULL
  ),
  cmds_terrain AS (
    SELECT s.id AS shop_id
    FROM reservations_terrain rt
    JOIN shops s ON s.merchant_id = rt.prestataire_id
    CROSS JOIN week_bounds wb
    WHERE rt.statut = 'paye'
      AND rt.created_at >= wb.week_start AND rt.created_at < wb.week_end
      AND s.merchant_id IS NOT NULL
  ),
  cmds_table_resa AS (
    SELECT vp.shop_id
    FROM table_reservations tr
    JOIN vip_profils vp ON vp.id = tr.vip_profil_id
    CROSS JOIN week_bounds wb
    WHERE tr.paiement_statut = 'paye'
      AND tr.created_at >= wb.week_start AND tr.created_at < wb.week_end
  ),
  -- UNION ALL : chaque achat/abonnement est compté individuellement
  cmds_all AS (
    SELECT shop_id FROM cmds_orders
    UNION ALL SELECT shop_id FROM cmds_fitness
    UNION ALL SELECT shop_id FROM cmds_terrain
    UNION ALL SELECT shop_id FROM cmds_table_resa
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds FROM cmds_all GROUP BY shop_id
  ),
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat, s.merchant_id
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
      AND s.merchant_id IS NOT NULL
  ),
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat, s.merchant_id
    FROM shops s
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) = 0
      AND s.category IS NOT NULL AND s.category <> ''
      AND s.merchant_id IS NOT NULL
  ),
  shops_sc AS (SELECT * FROM shops_avec_sc UNION ALL SELECT * FROM shops_sans_sc),
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
    points, nom, img, prestataire_id
  FROM scores ORDER BY 1 LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) TO anon, authenticated;


-- ── 2. calcul_classements_semaine (snapshot pg_cron) ─────────────────────────
-- Même fix UNION → UNION ALL pour cohérence avec la fonction live.

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
  cmds_orders AS (
    SELECT o.shop_id, o.client_id
    FROM orders o
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_week_start AND o.created_at < v_week_end
      AND o.client_id IS NOT NULL
  ),
  cmds_fitness AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat >= v_week_start AND fac.date_achat < v_week_end
      AND fac.statut = 'actif' AND s.merchant_id IS NOT NULL
  ),
  cmds_terrain AS (
    SELECT s.id AS shop_id, rt.client_id
    FROM reservations_terrain rt
    JOIN shops s ON s.merchant_id = rt.prestataire_id
    WHERE rt.statut = 'paye'
      AND rt.created_at >= v_week_start AND rt.created_at < v_week_end
      AND s.merchant_id IS NOT NULL
  ),
  cmds_table_resa AS (
    SELECT vp.shop_id, tr.client_id
    FROM table_reservations tr
    JOIN vip_profils vp ON vp.id = tr.vip_profil_id
    WHERE tr.paiement_statut = 'paye'
      AND tr.created_at >= v_week_start AND tr.created_at < v_week_end
  ),
  cmds_all AS (
    SELECT shop_id, client_id FROM cmds_orders
    UNION ALL SELECT shop_id, client_id FROM cmds_fitness
    UNION ALL SELECT shop_id, client_id FROM cmds_terrain
    UNION ALL SELECT shop_id, client_id FROM cmds_table_resa
  ),
  cmds_ranked AS (
    SELECT shop_id, client_id,
      ROW_NUMBER() OVER (PARTITION BY shop_id, client_id ORDER BY (SELECT NULL)) AS rn
    FROM cmds_all
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds FROM cmds_ranked WHERE rn <= 5 GROUP BY shop_id
  ),
  shops_avec_sc AS (
    SELECT s.id AS shop_id, s.merchant_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, sc_val.value AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0 AND s.merchant_id IS NOT NULL
  ),
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.merchant_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat
    FROM shops s
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) = 0
      AND s.category IS NOT NULL AND s.category <> '' AND s.merchant_id IS NOT NULL
  ),
  shops_sc AS (SELECT * FROM shops_avec_sc UNION ALL SELECT * FROM shops_sans_sc),
  scores AS (
    SELECT ss.merchant_id AS prestataire_id, ss.sous_cat, ss.nom, ss.img, ss.rating,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10 + ss.reviews_count * 3 + ss.rating * 2
      ) AS points
    FROM shops_sc ss LEFT JOIN cmds_valides cv ON cv.shop_id = ss.shop_id
  ),
  ranked AS (
    SELECT prestataire_id, sous_cat, nom, img, points, rating,
      ROW_NUMBER() OVER (
        PARTITION BY sous_cat ORDER BY points DESC, rating DESC, prestataire_id ASC
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


-- ── 3. Recalcul immédiat du snapshot semaine ──────────────────────────────────

DO $recalc$
DECLARE v_n INTEGER;
BEGIN
  SELECT public.calcul_classements_semaine() INTO v_n;
  RAISE NOTICE '[lassi] semaine recalculée (UNION ALL fix) : % lignes', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[lassi] erreur recalcul: %', SQLERRM;
END $recalc$;

NOTIFY pgrst, 'reload schema';
