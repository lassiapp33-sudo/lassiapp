-- ===========================================================================
-- LASSI — Correction classement fitness : utiliser processed_at (pas created_at)
-- ---------------------------------------------------------------------------
-- Le dashboard (get_daily_fitness_earnings) filtre pq.processed_at >= mois_start.
-- La migration précédente utilisait pq.created_at → manquait les payouts créés
-- en période précédente mais traités (paid) dans la période courante.
-- On aligne : classement = même signal que le dashboard.
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
      NOW() AT TIME ZONE 'UTC'                      AS week_end
  ),
  cmds_orders AS (
    SELECT o.shop_id
    FROM orders o CROSS JOIN week_bounds wb
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= wb.week_start AND o.created_at < wb.week_end
      AND o.client_id IS NOT NULL
  ),
  -- Abonnements achetés cette semaine (date_achat)
  cmds_fitness_by_date AS (
    SELECT s.id AS shop_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    CROSS JOIN week_bounds wb
    WHERE fac.date_achat >= wb.week_start AND fac.date_achat < wb.week_end
      AND fac.payment_intent_id IS NOT NULL
      AND s.merchant_id IS NOT NULL
  ),
  -- Abonnements dont le payout a été PAYÉ cette semaine (aligne avec le dashboard)
  cmds_fitness_by_payout AS (
    SELECT s.id AS shop_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    JOIN payout_queue pq ON pq.payment_intent_id = fac.payment_intent_id
    CROSS JOIN week_bounds wb
    WHERE pq.processed_at >= wb.week_start AND pq.processed_at < wb.week_end
      AND pq.statut = 'paid'
      AND fac.payment_intent_id IS NOT NULL
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
  cmds_all AS (
    SELECT shop_id FROM cmds_orders
    UNION SELECT shop_id FROM cmds_fitness_by_date
    UNION SELECT shop_id FROM cmds_fitness_by_payout
    UNION SELECT shop_id FROM cmds_terrain
    UNION SELECT shop_id FROM cmds_table_resa
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_all GROUP BY shop_id
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
    UNION ALL SELECT * FROM shops_sans_sc
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
    points, nom, img, prestataire_id
  FROM scores
  ORDER BY 1 LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_classement_live_sous_categorie(TEXT) TO anon, authenticated;


-- ── 2. get_classement_live_mondial ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_classement_live_mondial();

CREATE OR REPLACE FUNCTION public.get_classement_live_mondial()
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
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')                       AS mois_start,
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'  AS mois_end
  ),
  cmds_orders AS (
    SELECT o.shop_id, o.client_id
    FROM orders o CROSS JOIN month_bounds mb
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= mb.mois_start AND o.created_at < mb.mois_end
      AND o.client_id IS NOT NULL
  ),
  -- Abonnements achetés ce mois
  cmds_fitness_by_date AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    CROSS JOIN month_bounds mb
    WHERE fac.date_achat >= mb.mois_start AND fac.date_achat < mb.mois_end
      AND fac.payment_intent_id IS NOT NULL
      AND s.merchant_id IS NOT NULL
  ),
  -- Abonnements dont le payout a été PAYÉ ce mois (aligne avec le dashboard)
  cmds_fitness_by_payout AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    JOIN payout_queue pq ON pq.payment_intent_id = fac.payment_intent_id
    CROSS JOIN month_bounds mb
    WHERE pq.processed_at >= mb.mois_start AND pq.processed_at < mb.mois_end
      AND pq.statut = 'paid'
      AND fac.payment_intent_id IS NOT NULL
      AND s.merchant_id IS NOT NULL
  ),
  cmds_terrain AS (
    SELECT s.id AS shop_id, rt.client_id
    FROM reservations_terrain rt
    JOIN shops s ON s.merchant_id = rt.prestataire_id
    CROSS JOIN month_bounds mb
    WHERE rt.statut = 'paye'
      AND rt.created_at >= mb.mois_start AND rt.created_at < mb.mois_end
      AND s.merchant_id IS NOT NULL
  ),
  cmds_table_resa AS (
    SELECT vp.shop_id, tr.client_id
    FROM table_reservations tr
    JOIN vip_profils vp ON vp.id = tr.vip_profil_id
    CROSS JOIN month_bounds mb
    WHERE tr.paiement_statut = 'paye'
      AND tr.created_at >= mb.mois_start AND tr.created_at < mb.mois_end
  ),
  cmds_all AS (
    SELECT shop_id, client_id FROM cmds_orders
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_date
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_payout
    UNION SELECT shop_id, client_id FROM cmds_terrain
    UNION SELECT shop_id, client_id FROM cmds_table_resa
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
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY points DESC, rating DESC, shop_created ASC, prestataire_id ASC)::INTEGER,
    points, nom, img, prestataire_id
  FROM scores ORDER BY 1 LIMIT 40;
$$;

REVOKE EXECUTE ON FUNCTION public.get_classement_live_mondial() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_classement_live_mondial() TO anon, authenticated;


-- ── 3. calcul_classements_semaine ────────────────────────────────────────────

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
  cmds_fitness_by_date AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat >= v_week_start AND fac.date_achat < v_week_end
      AND fac.payment_intent_id IS NOT NULL AND s.merchant_id IS NOT NULL
  ),
  cmds_fitness_by_payout AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    JOIN payout_queue pq ON pq.payment_intent_id = fac.payment_intent_id
    WHERE pq.processed_at >= v_week_start AND pq.processed_at < v_week_end
      AND pq.statut = 'paid'
      AND fac.payment_intent_id IS NOT NULL AND s.merchant_id IS NOT NULL
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
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_date
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_payout
    UNION SELECT shop_id, client_id FROM cmds_terrain
    UNION SELECT shop_id, client_id FROM cmds_table_resa
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
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
      AND s.merchant_id IS NOT NULL
  ),
  shops_sans_sc AS (
    SELECT s.id AS shop_id, s.merchant_id, s.name AS nom, s.logo_url AS img,
           s.rating, s.reviews_count, s.category AS sous_cat
    FROM shops s
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) = 0
      AND s.category IS NOT NULL AND s.category <> ''
      AND s.merchant_id IS NOT NULL
  ),
  shops_sc AS (SELECT * FROM shops_avec_sc UNION ALL SELECT * FROM shops_sans_sc),
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


-- ── 4. calcul_classements_mois ───────────────────────────────────────────────

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

  -- ── Mondial ───────────────────────────────────────────────────────────────
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
  cmds_fitness_by_date AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL AND s.merchant_id IS NOT NULL
  ),
  cmds_fitness_by_payout AS (
    SELECT s.id AS shop_id, fac.client_id
    FROM fitness_abonnements_clients fac
    JOIN shops s ON s.merchant_id = fac.prestataire_id
    JOIN payout_queue pq ON pq.payment_intent_id = fac.payment_intent_id
    WHERE pq.processed_at >= v_mois_start AND pq.processed_at < v_mois_end
      AND pq.statut = 'paid'
      AND fac.payment_intent_id IS NOT NULL AND s.merchant_id IS NOT NULL
  ),
  cmds_terrain AS (
    SELECT s.id AS shop_id, rt.client_id
    FROM reservations_terrain rt
    JOIN shops s ON s.merchant_id = rt.prestataire_id
    WHERE rt.statut = 'paye'
      AND rt.created_at >= v_mois_start AND rt.created_at < v_mois_end
      AND s.merchant_id IS NOT NULL
  ),
  cmds_table_resa AS (
    SELECT vp.shop_id, tr.client_id
    FROM table_reservations tr
    JOIN vip_profils vp ON vp.id = tr.vip_profil_id
    WHERE tr.paiement_statut = 'paye'
      AND tr.created_at >= v_mois_start AND tr.created_at < v_mois_end
  ),
  cmds_all AS (
    SELECT shop_id, client_id FROM cmds_orders
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_date
    UNION SELECT shop_id, client_id FROM cmds_fitness_by_payout
    UNION SELECT shop_id, client_id FROM cmds_terrain
    UNION SELECT shop_id, client_id FROM cmds_table_resa
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

  -- ── Quartiers ─────────────────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'quartier' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
  WITH
  client_orders AS (
    SELECT p.zone, COUNT(*) AS nb_cmds
    FROM orders o JOIN profiles p ON p.id = o.client_id
    WHERE o.status = 'done' AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start AND o.created_at < v_mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  client_avis AS (
    SELECT p.zone, COUNT(*) AS nb_avis
    FROM avis a JOIN profiles p ON p.id = a.author_id
    WHERE NOT a.masque
      AND a.created_at >= v_mois_start AND a.created_at < v_mois_end
      AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
    GROUP BY p.zone
  ),
  zone_scores AS (
    SELECT
      p.zone,
      SUM(COALESCE(co.nb_cmds, 0) * 10 + COALESCE(ca.nb_avis, 0) * 5)::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders co ON co.zone = p.zone
    LEFT JOIN client_avis   ca ON ca.zone = p.zone
    WHERE p.role = 'client' AND p.zone IS NOT NULL AND TRIM(p.zone) != ''
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

  -- ── Top clients ───────────────────────────────────────────────────────────
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
  client_fitness_by_date AS (
    SELECT fac.client_id, COUNT(*) AS nb_abo
    FROM fitness_abonnements_clients fac
    WHERE fac.date_achat >= v_mois_start AND fac.date_achat < v_mois_end
      AND fac.payment_intent_id IS NOT NULL
    GROUP BY fac.client_id
  ),
  client_fitness_by_payout AS (
    SELECT fac.client_id, COUNT(*) AS nb_abo
    FROM fitness_abonnements_clients fac
    JOIN payout_queue pq ON pq.payment_intent_id = fac.payment_intent_id
    WHERE pq.processed_at >= v_mois_start AND pq.processed_at < v_mois_end
      AND pq.statut = 'paid'
      AND fac.payment_intent_id IS NOT NULL
    GROUP BY fac.client_id
  ),
  client_fitness_c AS (
    SELECT client_id, SUM(nb_abo)::BIGINT AS nb_abo
    FROM (
      SELECT client_id, nb_abo FROM client_fitness_by_date
      UNION ALL
      SELECT client_id, nb_abo FROM client_fitness_by_payout
    ) t
    GROUP BY client_id
  ),
  client_terrain_c AS (
    SELECT rt.client_id, COUNT(*) AS nb_terrain
    FROM reservations_terrain rt
    WHERE rt.statut = 'paye'
      AND rt.created_at >= v_mois_start AND rt.created_at < v_mois_end
      AND rt.client_id IS NOT NULL
    GROUP BY rt.client_id
  ),
  client_table_c AS (
    SELECT tr.client_id, COUNT(*) AS nb_table
    FROM table_reservations tr
    WHERE tr.paiement_statut = 'paye'
      AND tr.created_at >= v_mois_start AND tr.created_at < v_mois_end
    GROUP BY tr.client_id
  ),
  client_avis_c AS (
    SELECT author_id, COUNT(*) AS nb_avis FROM avis
    WHERE NOT masque AND created_at >= v_mois_start AND created_at < v_mois_end
    GROUP BY author_id
  ),
  scores_c AS (
    SELECT
      p.id AS client_id, p.name AS nom, p.avatar_url AS img,
      (
        (COALESCE(co.nb_cmds,     0) + COALESCE(cf.nb_abo,     0)
         + COALESCE(ct.nb_terrain, 0) + COALESCE(ctbl.nb_table, 0)) * 10
        + COALESCE(ca.nb_avis, 0) * 5
      )::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders_c  co   ON co.client_id   = p.id
    LEFT JOIN client_fitness_c cf   ON cf.client_id   = p.id
    LEFT JOIN client_terrain_c ct   ON ct.client_id   = p.id
    LEFT JOIN client_table_c   ctbl ON ctbl.client_id = p.id
    LEFT JOIN client_avis_c    ca   ON ca.author_id   = p.id
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


-- ── 5. Recalcul immédiat ──────────────────────────────────────────────────────

DO $recalc$
DECLARE v_n INTEGER;
BEGIN
  SELECT public.calcul_classements_semaine() INTO v_n;
  RAISE NOTICE '[lassi] semaine recalculé (processed_at fix) : % lignes', v_n;
  SELECT public.calcul_classements_mois() INTO v_n;
  RAISE NOTICE '[lassi] mois recalculé (processed_at fix) : % lignes', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[lassi] erreur recalcul: %', SQLERRM;
END $recalc$;

NOTIFY pgrst, 'reload schema';
