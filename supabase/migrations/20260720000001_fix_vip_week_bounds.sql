-- ===========================================================================
-- Fix : update_vip_rankings() utilisait DATE_TRUNC('week', NOW()) comme
-- week_start, ce qui donnait une fenêtre de 0 seconde quand la fonction
-- s'exécute à lundi 00h00. Aucune commande qualifiait → 0 VIP partout.
--
-- Correction : la fenêtre couvre maintenant la SEMAINE PRÉCÉDENTE
--   week_start = lundi précédent 00:00 UTC
--   week_end   = ce lundi        00:00 UTC  (exclusif)
-- La clé v_semaine est celle de la semaine précédente pour correspondre.
--
-- Le nettoyage initial supprime les entrées vip_run_log où 0 shop a été
-- classé (symptôme de la fenêtre vide), pour éviter le blocage doublon.
-- ===========================================================================

-- ─── 1. Nettoyer les logs parasites (fenêtre vide → 0 shop) ─────────────────

DELETE FROM vip_run_log
WHERE statut = 'ok'
  AND details LIKE '%0 shop(s) dans le podium%';

-- ─── 2. Version corrigée de update_vip_rankings() ────────────────────────────

CREATE OR REPLACE FUNCTION update_vip_rankings(
  p_run_by TEXT DEFAULT 'cron'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semaine      TEXT;
  v_settings     RECORD;
  v_podium_size  INTEGER;
  v_already_run  BOOLEAN;
  v_updated      INTEGER := 0;
  v_result       JSONB;
BEGIN
  -- Clé ISO de la SEMAINE PRÉCÉDENTE (celle qu'on est en train de classer)
  -- Ex : si on tourne lundi 20 juil, on classe la semaine lun 13→dim 19 juil = W29
  v_semaine := TO_CHAR(
    (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days',
    'IYYY"-W"IW'
  );

  -- Charger les poids de configuration
  SELECT * INTO v_settings FROM vip_settings WHERE id = 1;
  v_podium_size := COALESCE(v_settings.taille_podium, 3);

  -- Idempotence : semaine déjà traitée avec succès ?
  SELECT EXISTS (
    SELECT 1 FROM vip_run_log
    WHERE semaine = v_semaine AND statut = 'ok'
  ) INTO v_already_run;

  IF v_already_run THEN
    INSERT INTO vip_run_log (semaine, statut, details, run_by)
    VALUES (v_semaine, 'doublon',
            'Semaine ' || v_semaine || ' déjà traitée — aucun changement.',
            p_run_by);
    RETURN jsonb_build_object(
      'ok', false, 'semaine', v_semaine,
      'motif', 'doublon — semaine déjà traitée'
    );
  END IF;

  BEGIN

    -- Étape 1 : reset global
    UPDATE shops SET is_vip = false, vip_rank = NULL;

    -- Étape 2 : supprimer les entrées auto de cette semaine (relance manuelle)
    DELETE FROM vip_rankings
    WHERE semaine = v_semaine AND source = 'auto';

    -- Étape 3 : calcul du score sur la SEMAINE PRÉCÉDENTE
    --   week_start = lundi précédent 00:00 UTC
    --   week_end   = ce lundi        00:00 UTC  (exclusif)
    WITH

    week_bounds AS (
      SELECT
        DATE_TRUNC('week', (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days') AS week_start,
        DATE_TRUNC('week',  NOW() AT TIME ZONE 'UTC')                       AS week_end
    ),

    eligible_orders AS (
      SELECT
        o.shop_id,
        o.client_id,
        LEAST(COALESCE(o.total, 0), v_settings.cap_ca_par_commande) AS ca_capped,
        ROW_NUMBER() OVER (
          PARTITION BY o.shop_id, o.client_id
          ORDER BY o.created_at
        ) AS rn_per_client
      FROM orders o
      JOIN shops s ON s.id = o.shop_id
      CROSS JOIN week_bounds wb
      WHERE o.status     = 'done'
        AND o.pay_method IN ('wave', 'om')
        AND o.created_at >= wb.week_start
        AND o.created_at <  wb.week_end
        AND s.vip_exclu  = FALSE
        AND o.client_id IS NOT NULL
        AND o.client_id <> s.merchant_id
    ),

    capped_orders AS (
      SELECT *
      FROM eligible_orders
      WHERE rn_per_client <= v_settings.plafond_par_client
    ),

    shop_stats AS (
      SELECT
        shop_id,
        COUNT(*)       AS nb_orders,
        SUM(ca_capped) AS ca_total
      FROM capped_orders
      GROUP BY shop_id
    ),

    shop_scores AS (
      SELECT
        s.id          AS shop_id,
        s.category,
        s.created_at  AS shop_created,
        s.rating,
        COALESCE(ss.nb_orders, 0) AS nb_orders,
        COALESCE(ss.ca_total,  0) AS ca_total,
        (
          (COALESCE(ss.nb_orders, 0)::NUMERIC
            * v_settings.poids_commandes / 100.0)
          + (LEAST(COALESCE(ss.ca_total, 0), 1000000)::NUMERIC / 10000.0
            * v_settings.poids_ca / 100.0)
          + (s.rating * SQRT(GREATEST(s.reviews_count, 0) + 1)
            * v_settings.poids_note / 100.0)
        ) AS score
      FROM shops s
      LEFT JOIN shop_stats ss ON ss.shop_id = s.id
      WHERE s.vip_exclu = FALSE
    ),

    ranked AS (
      SELECT
        shop_id,
        category,
        score,
        ROW_NUMBER() OVER (
          PARTITION BY category
          ORDER BY
            score        DESC,
            rating       DESC,
            shop_created ASC,
            MD5(shop_id::text || v_semaine) ASC
        ) AS rang
      FROM shop_scores
      WHERE nb_orders > 0
    )

    INSERT INTO vip_rankings (semaine, shop_id, categorie, rang, score, source)
    SELECT v_semaine, shop_id, category, rang, score, 'auto'
    FROM ranked
    WHERE rang <= v_podium_size;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Étape 4 : mettre à jour is_vip + vip_rank dans shops
    UPDATE shops s
    SET is_vip   = true,
        vip_rank = vr.rang
    FROM vip_rankings vr
    WHERE vr.shop_id = s.id
      AND vr.semaine = v_semaine
      AND vr.source  = 'auto'
      AND vr.rang    <= v_podium_size;

    -- Étape 5 : log de succès
    INSERT INTO vip_run_log (semaine, statut, details, run_by)
    VALUES (
      v_semaine, 'ok',
      'Classement mis à jour — ' || v_updated || ' shop(s) dans le podium.',
      p_run_by
    );

    v_result := jsonb_build_object(
      'ok', true,
      'semaine', v_semaine,
      'shops_in_podium', v_updated
    );

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO vip_run_log (semaine, statut, details, run_by)
    VALUES (v_semaine, 'erreur', SQLERRM, p_run_by);

    RETURN jsonb_build_object(
      'ok', false,
      'semaine', v_semaine,
      'erreur', SQLERRM
    );
  END;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_vip_rankings(TEXT) TO service_role;

-- ─── 3. Exécution immédiate pour corriger la semaine en cours ────────────────

DO $$
DECLARE
  v_res JSONB;
BEGIN
  SELECT update_vip_rankings('migration-fix-20260720') INTO v_res;
  RAISE NOTICE 'update_vip_rankings résultat : %', v_res;
END $$;

NOTIFY pgrst, 'reload schema';
