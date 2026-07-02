-- ===========================================================================
-- LASSI — Système de Classements complet
-- Crée la table classements + fonctions de scoring + CRON jobs
-- Remplace les migrations jamais créées :
--   20260611130000_cron_classements.sql
--   20260612140000_classement_mensuel_progressif.sql
-- ===========================================================================

-- ─── 1. TABLE classements ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT        NOT NULL
    CHECK (type IN ('sous_categorie','mondial','quartier','client')),
  sous_categorie  TEXT,
  periode         TEXT        NOT NULL,   -- 'IYYY-SWW' ou 'YYYY-MM'
  rang            INTEGER     NOT NULL,
  points          NUMERIC     NOT NULL DEFAULT 0,
  nom_affiche     TEXT        NOT NULL DEFAULT '',
  image_url       TEXT,
  prestataire_id  UUID        REFERENCES shops(id)    ON DELETE CASCADE,
  client_id       UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  est_actif       BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS classements_type_sc_periode_rang_idx
  ON classements (type, COALESCE(sous_categorie,''), periode, rang);

CREATE INDEX IF NOT EXISTS classements_lookup_idx
  ON classements (type, periode, est_actif, rang);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE classements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "classements_public_read" ON classements
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "classements_service_write" ON classements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. HELPER : semaine ISO courante (IYYY-SWW) ─────────────────────────────

CREATE OR REPLACE FUNCTION current_iso_week()
RETURNS TEXT
LANGUAGE sql
STABLE PARALLEL SAFE
SECURITY INVOKER
AS $$
  SELECT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY"-S"IW');
$$;

-- ─── 4. CRITÈRES DE POINTS ───────────────────────────────────────────────────
--
-- Sous-catégorie (hebdomadaire) :
--   • Base       = rating × 2        (donne des points même sans commande)
--   • Commandes  = nb_cmds × 10      (validées wave/om cette semaine; max 5/client)
--   • Avis       = reviews_count × 3 (cumul total des avis reçus)
--
-- Mondial (mensuel) :
--   • Base       = rating × sqrt(reviews_count + 1) × 2
--   • Commandes  = nb_cmds × 10      (validées wave/om ce mois; max 20/client)
--   • Avis       = reviews_count × 3
--
-- Quartier (mensuel) :
--   • Somme des scores individuels de chaque boutique de la zone
--
-- Clients (mensuel) :
--   • Commandes passées × 10 pts
--   • Avis écrits × 5 pts
--
-- Tous les prestataires actifs apparaissent, même sans commande.

-- ─── 5. FONCTION : classement sous-catégories (hebdomadaire) ─────────────────

CREATE OR REPLACE FUNCTION calcul_classements_semaine(
  p_periode TEXT DEFAULT NULL   -- NULL = semaine courante IYYY-SWW
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_periode    TEXT;
  v_week_start TIMESTAMPTZ;
  v_week_end   TIMESTAMPTZ;
  v_updated    INTEGER;
BEGIN
  v_periode := COALESCE(p_periode, current_iso_week());

  -- Convertir 'IYYY-SWW' → lundi 00:00 UTC de cette semaine
  v_week_start := (
    TO_DATE(REPLACE(v_periode, '-S', '-'), 'IYYY-IW')::TIMESTAMP
  ) AT TIME ZONE 'UTC';
  v_week_end := v_week_start + INTERVAL '7 days';

  -- Supprimer les entrées de cette période pour recalcul propre
  DELETE FROM classements
  WHERE type = 'sous_categorie' AND periode = v_periode;

  -- Calculer le scoring et insérer (top 20 par sous-catégorie)
  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH

  -- Commandes validées de la semaine, avec anti-triche (max 5/client/shop)
  cmds_brutes AS (
    SELECT
      o.shop_id,
      o.client_id,
      ROW_NUMBER() OVER (
        PARTITION BY o.shop_id, o.client_id
        ORDER BY o.created_at
      ) AS rn_client
    FROM orders o
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_week_start
      AND o.created_at <  v_week_end
      AND o.client_id IS NOT NULL
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_brutes
    WHERE rn_client <= 5
    GROUP BY shop_id
  ),

  -- Déplier shops × sous-catégories
  shops_sc AS (
    SELECT
      s.id             AS shop_id,
      s.name           AS nom,
      s.logo_url       AS img,
      s.rating,
      s.reviews_count,
      sc_val.value     AS sous_cat
    FROM shops s
    CROSS JOIN LATERAL jsonb_array_elements_text(s.subcategories) sc_val(value)
    WHERE jsonb_array_length(COALESCE(s.subcategories, '[]'::jsonb)) > 0
  ),

  -- Score par shop × sous-catégorie
  scores AS (
    SELECT
      ss.shop_id,
      ss.sous_cat,
      ss.nom,
      ss.img,
      ss.rating,
      ROUND(
        COALESCE(cv.nb_cmds, 0) * 10         -- commandes × 10
        + ss.reviews_count          * 3       -- avis total × 3
        + ss.rating                 * 2       -- note × 2 (base même sans cmd)
      ) AS points
    FROM shops_sc ss
    LEFT JOIN cmds_valides cv ON cv.shop_id = ss.shop_id
  ),

  -- Rang dans chaque sous-catégorie
  ranked AS (
    SELECT
      shop_id, sous_cat, nom, img, points, rating,
      ROW_NUMBER() OVER (
        PARTITION BY sous_cat
        ORDER BY points DESC, rating DESC, shop_id ASC
      ) AS rang
    FROM scores
  )

  SELECT
    'sous_categorie',
    sous_cat,
    v_periode,
    rang::INTEGER,
    points,
    nom,
    img,
    shop_id,
    TRUE,
    NOW()
  FROM ranked
  WHERE rang <= 20;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ─── 6. FONCTION : classements mensuels (mondial + quartier + clients) ────────

CREATE OR REPLACE FUNCTION calcul_classements_mois(
  p_periode TEXT DEFAULT NULL   -- NULL = mois courant YYYY-MM
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- ── 6a. Mondial (top 40 national) ──────────────────────────────────────────
  DELETE FROM classements WHERE type = 'mondial' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH

  cmds_brutes AS (
    SELECT
      o.shop_id,
      o.client_id,
      ROW_NUMBER() OVER (
        PARTITION BY o.shop_id, o.client_id
        ORDER BY o.created_at
      ) AS rn_client
    FROM orders o
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start
      AND o.created_at <  v_mois_end
      AND o.client_id IS NOT NULL
  ),
  cmds_valides AS (
    SELECT shop_id, COUNT(*) AS nb_cmds
    FROM cmds_brutes
    WHERE rn_client <= 20   -- anti-triche mensuel
    GROUP BY shop_id
  ),

  scores AS (
    SELECT
      s.id         AS shop_id,
      s.name       AS nom,
      s.logo_url   AS img,
      s.rating,
      s.created_at AS shop_created,
      ROUND(
        COALESCE(cv.nb_cmds, 0)  * 10
        + s.reviews_count        * 3
        + s.rating * SQRT(GREATEST(s.reviews_count, 0) + 1) * 2
      ) AS points
    FROM shops s
    LEFT JOIN cmds_valides cv ON cv.shop_id = s.id
    WHERE COALESCE(s.vip_exclu, FALSE) = FALSE
  ),

  ranked AS (
    SELECT
      shop_id, nom, img, points, rating, shop_created,
      ROW_NUMBER() OVER (
        ORDER BY points DESC, rating DESC, shop_created ASC, shop_id ASC
      ) AS rang
    FROM scores
  )

  SELECT 'mondial', NULL, v_periode, rang::INTEGER, points, nom, img, shop_id, TRUE, NOW()
  FROM ranked
  WHERE rang <= 40;

  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── 6b. Quartiers (top 10 zones) ───────────────────────────────────────────
  DELETE FROM classements WHERE type = 'quartier' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif, updated_at)
  WITH

  cmds_zone AS (
    SELECT o.shop_id, COUNT(*) AS nb_cmds
    FROM orders o
    WHERE o.status     = 'done'
      AND o.pay_method IN ('wave', 'om')
      AND o.created_at >= v_mois_start
      AND o.created_at <  v_mois_end
    GROUP BY o.shop_id
  ),

  zone_scores AS (
    SELECT
      s.zone,
      ROUND(
        SUM(COALESCE(c.nb_cmds, 0)) * 10
        + SUM(s.reviews_count)       * 3
        + SUM(s.rating)              * 2
      ) AS points
    FROM shops s
    LEFT JOIN cmds_zone c ON c.shop_id = s.id
    WHERE s.zone IS NOT NULL AND TRIM(s.zone) <> ''
    GROUP BY s.zone
  ),

  ranked_q AS (
    SELECT zone, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, zone ASC) AS rang
    FROM zone_scores
  )

  SELECT 'quartier', NULL, v_periode, rang::INTEGER, points, zone, NULL, NULL, TRUE, NOW()
  FROM ranked_q
  WHERE rang <= 10;

  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  -- ── 6c. Top clients (top 10) ────────────────────────────────────────────────
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif, updated_at)
  WITH

  client_orders AS (
    SELECT client_id, COUNT(*) AS nb_cmds
    FROM orders
    WHERE status = 'done'
      AND created_at >= v_mois_start
      AND created_at <  v_mois_end
      AND client_id IS NOT NULL
    GROUP BY client_id
  ),

  client_avis AS (
    SELECT author_id, COUNT(*) AS nb_avis
    FROM avis
    WHERE NOT masque
      AND created_at >= v_mois_start
      AND created_at <  v_mois_end
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
    JOIN client_orders co ON co.client_id = p.id
    LEFT JOIN client_avis ca ON ca.author_id = p.id
    WHERE COALESCE(co.nb_cmds, 0) > 0
  ),

  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )

  SELECT 'client', NULL, v_periode, rang::INTEGER, points, nom, img, client_id, TRUE, NOW()
  FROM ranked_c
  WHERE rang <= 10;

  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_updated := v_updated + v_partial;

  RETURN v_updated;
END;
$$;

-- ─── 7. GRANTS ───────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION calcul_classements_semaine(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION calcul_classements_mois(TEXT)    TO service_role;
GRANT EXECUTE ON FUNCTION current_iso_week()               TO authenticated, service_role;

-- ─── 8. POPULATION INITIALE ──────────────────────────────────────────────────
-- Semaine courante (sera affichée la semaine prochaine par getPeriodeSemaine)
-- Semaine précédente (affichée cette semaine par getPeriodeSemaine)
-- Mois courant

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

  -- Sous-catégorie: semaine courante
  SELECT calcul_classements_semaine(v_current_week) INTO v_n;
  RAISE NOTICE 'Classements sous_categorie semaine % : % lignes', v_current_week, v_n;

  -- Sous-catégorie: semaine précédente (ce que getPeriodeSemaine() retourne actuellement)
  IF v_previous_week <> v_current_week THEN
    SELECT calcul_classements_semaine(v_previous_week) INTO v_n;
    RAISE NOTICE 'Classements sous_categorie semaine % : % lignes', v_previous_week, v_n;
  END IF;

  -- Mensuel (mondial + quartier + clients)
  SELECT calcul_classements_mois(v_current_month) INTO v_n;
  RAISE NOTICE 'Classements mensuel % : % lignes', v_current_month, v_n;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur initialisation classements: %', SQLERRM;
END $init$;

-- ─── 9. CRON JOBS ────────────────────────────────────────────────────────────
-- Dimanche 23:45 UTC : recalcul hebdomadaire sous-catégories
-- Dimanche 23:55 UTC : aperçu mensuel (mondial/quartier/clients)
-- 1er du mois 00:05 UTC : recalcul mensuel final (récompenses)

DO $cron1$
BEGIN
  PERFORM cron.unschedule('lassi-classements-semaine');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron1$;

DO $cron2$
BEGIN
  PERFORM cron.schedule(
    'lassi-classements-semaine',
    '45 23 * * 0',
    $sql$
      SET statement_timeout = '300000';
      SELECT calcul_classements_semaine();
    $sql$
  );
  RAISE NOTICE 'CRON lassi-classements-semaine planifié (dim 23h45 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponible: %', SQLERRM;
END $cron2$;

DO $cron3$
BEGIN
  PERFORM cron.unschedule('lassi-classements-mois-preview');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron3$;

DO $cron4$
BEGIN
  PERFORM cron.schedule(
    'lassi-classements-mois-preview',
    '55 23 * * 0',
    $sql$
      SET statement_timeout = '300000';
      SELECT calcul_classements_mois();
    $sql$
  );
  RAISE NOTICE 'CRON lassi-classements-mois-preview planifié (dim 23h55 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponible: %', SQLERRM;
END $cron4$;

NOTIFY pgrst, 'reload schema';
