-- ===========================================================================
-- LASSİ — Système VIP v2 : scoring sécurisé, historisé, anti-triche
-- SAFE à re-exécuter (IF NOT EXISTS / DO EXCEPTION partout)
-- À lancer dans Supabase > SQL Editor
-- ===========================================================================

-- ─── 1. NOUVELLES COLONNES sur shops ─────────────────────────────────────────
-- vip_exclu  : exclure définitivement du podium VIP (décision admin)
-- vip_rank   : rang actuel dans le podium (1, 2, 3 … NULL si pas VIP)

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS vip_exclu BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vip_rank  INTEGER;

-- ─── 2. TABLE vip_settings (config des poids — éditable par l'admin) ─────────

CREATE TABLE IF NOT EXISTS vip_settings (
  id                   INTEGER  PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  poids_commandes      NUMERIC  NOT NULL DEFAULT 60,   -- % du score total
  poids_ca             NUMERIC  NOT NULL DEFAULT 20,   -- % du score (CA plafonné)
  poids_note           NUMERIC  NOT NULL DEFAULT 20,   -- % du score (note pondérée)
  cap_ca_par_commande  NUMERIC  NOT NULL DEFAULT 50000, -- XOF max par commande (anti-whale)
  plafond_par_client   INTEGER  NOT NULL DEFAULT 5,    -- max commandes d'1 client par semaine
  taille_podium        INTEGER  NOT NULL DEFAULT 3,    -- rang max = VIP
  updated_by           UUID     REFERENCES profiles(id),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les valeurs par défaut si la table est vide
INSERT INTO vip_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ─── 3. TABLE vip_rankings (historique hebdomadaire) ─────────────────────────

CREATE TABLE IF NOT EXISTS vip_rankings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine     TEXT        NOT NULL,    -- ex : '2026-W23'
  shop_id     UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  categorie   TEXT        NOT NULL,
  rang        INTEGER     NOT NULL,    -- 1, 2, 3…
  score       NUMERIC     NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','manuel')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vip_rankings_semaine_shop_idx
  ON vip_rankings (semaine, shop_id);

CREATE INDEX IF NOT EXISTS vip_rankings_semaine_cat_idx
  ON vip_rankings (semaine, categorie, rang);

-- ─── 4. TABLE vip_run_log (journal des exécutions) ───────────────────────────

CREATE TABLE IF NOT EXISTS vip_run_log (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine   TEXT        NOT NULL,
  run_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statut    TEXT        NOT NULL CHECK (statut IN ('ok','erreur','doublon')),
  details   TEXT,
  run_by    TEXT        DEFAULT 'cron'  -- 'cron' | admin UUID
);

CREATE INDEX IF NOT EXISTS vip_run_log_semaine_idx ON vip_run_log (semaine);

-- ─── 5. RLS NOUVELLES TABLES ─────────────────────────────────────────────────

ALTER TABLE vip_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_rankings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_run_log   ENABLE ROW LEVEL SECURITY;

-- vip_settings : lecture publique, écriture admin/service uniquement
DO $$ BEGIN
  CREATE POLICY "vip_settings_select_all" ON vip_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vip_settings_admin_write" ON vip_settings FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vip_rankings : lecture publique (podium visible côté app), écriture réservée
DO $$ BEGIN
  CREATE POLICY "vip_rankings_select_all" ON vip_rankings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vip_rankings_admin_write" ON vip_rankings FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vip_run_log : lecture admin uniquement
DO $$ BEGIN
  CREATE POLICY "vip_run_log_admin_only" ON vip_run_log FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. PROTÉGER LES CHAMPS VIP VIA TRIGGER (column-level protection) ────────
-- RLS ne permet pas de bloquer des colonnes spécifiques nativement.
-- Ce trigger BEFORE UPDATE rétablit les champs VIP si le caller n'est pas
-- le service_role ou un admin authentifié.
--
-- Logique de confiance :
--   auth.role() IS NULL       → appel DB direct (pg_cron, migrations) → AUTORISÉ
--   auth.role() = 'service_role' → Edge Function admin → AUTORISÉ
--   auth.role() = 'authenticated' AND is_admin = true → Admin app → AUTORISÉ
--   Tout le reste → champs restaurés silencieusement

CREATE OR REPLACE FUNCTION shops_protect_vip_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jwt_role TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Lire le rôle JWT (NULL si appel direct DB / pg_cron)
  v_jwt_role := auth.role();

  -- Appels directs DB (pg_cron, migrations, SECURITY DEFINER functions) → autorisés
  IF v_jwt_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- service_role JWT (Edge Functions admin) → autorisé
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Utilisateur authentifié : vérifier s'il est admin
  IF v_jwt_role = 'authenticated' AND auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin
    FROM profiles WHERE id = auth.uid();
    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tous les autres : restaurer silencieusement les champs protégés
  NEW.is_vip            := OLD.is_vip;
  NEW.vip_exclu         := OLD.vip_exclu;
  NEW.vip_manual        := OLD.vip_manual;
  NEW.vip_manual_until  := OLD.vip_manual_until;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_vip_protect ON shops;
CREATE TRIGGER shops_vip_protect
  BEFORE UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION shops_protect_vip_fields();

-- ─── 7. FONCTION update_vip_rankings() — VERSION SÉCURISÉE ───────────────────
--
-- Sécurités :
--   - IDEMPOTENTE : si déjà exécutée pour cette semaine → log 'doublon', pas d'effet
--   - ANTI-TRICHE : plafond par client (plafond_par_client dans vip_settings)
--   - DONNÉES VÉRIFIÉES : commandes done + payées wave/om uniquement
--   - ANNULÉES EXCLUES : status <> 'refused'/'cancelled' (déjà capturé par = 'done')
--   - vip_exclu : shops exclus par l'admin ignorés du classement
--   - CA PLAFONNÉ : chaque commande est plafonnée à cap_ca_par_commande
--   - NOTE PONDÉRÉE : note × sqrt(reviews_count) pour éviter les notes sur peu d'avis
--   - ATOMIQUE : tout dans une transaction (la fonction PL/pgSQL est atomique par défaut)
--   - HISTORISATION : insère dans vip_rankings + met à jour shops.is_vip
--   - TIE-BREAKING : note pondérée → date inscription → seed stable (semaine ISO)
--

CREATE OR REPLACE FUNCTION update_vip_rankings(
  p_run_by TEXT DEFAULT 'cron'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_semaine      TEXT;
  v_settings     RECORD;
  v_podium_size  INTEGER;
  v_already_run  BOOLEAN;
  v_updated      INTEGER := 0;
  v_result       JSONB;
BEGIN
  -- Calcul de la clé de semaine ISO (ex : '2026-W23')
  v_semaine := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY"-W"IW');

  -- Charger les poids de configuration
  SELECT * INTO v_settings FROM vip_settings WHERE id = 1;
  v_podium_size := COALESCE(v_settings.taille_podium, 3);

  -- Vérification idempotence : cette semaine a-t-elle déjà été traitée avec succès ?
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

  BEGIN -- Bloc transaction (rollback si erreur)

    -- Étape 1 : remettre is_vip et vip_rank à zéro pour tout le monde
    UPDATE shops SET is_vip = false, vip_rank = NULL;

    -- Étape 2 : supprimer les anciennes entrées auto de cette semaine (relance manuelle)
    DELETE FROM vip_rankings
    WHERE semaine = v_semaine AND source = 'auto';

    -- Étape 3 : calcul du score par shop sur la semaine écoulée
    -- Fenêtre : lundi 00:00 UTC de la semaine courante → maintenant
    WITH

    -- Bornes de la semaine courante (lundi 00:00 UTC)
    week_bounds AS (
      SELECT
        DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') AS week_start,
        NOW() AT TIME ZONE 'UTC'                      AS week_end
    ),

    -- Commandes éligibles : done + wave/om + dans la fenêtre + shop non exclu
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
        AND o.client_id <> s.merchant_id  -- exclut auto-commandes
    ),

    -- Anti-triche : plafonner la contribution par client par shop
    capped_orders AS (
      SELECT *
      FROM eligible_orders
      WHERE rn_per_client <= v_settings.plafond_par_client
    ),

    -- Agréger : nb commandes plafonnées + CA plafonné par shop
    shop_stats AS (
      SELECT
        shop_id,
        COUNT(*)   AS nb_orders,
        SUM(ca_capped) AS ca_total
      FROM capped_orders
      GROUP BY shop_id
    ),

    -- Score pondéré selon vip_settings
    -- Note pondérée = rating × sqrt(reviews_count+1) pour équité petits/gros shops
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

    -- Classement par catégorie (tie-breaking : note, ancienneté, seed stable)
    ranked AS (
      SELECT
        shop_id,
        category,
        score,
        ROW_NUMBER() OVER (
          PARTITION BY category
          ORDER BY
            score          DESC,
            rating         DESC,
            shop_created   ASC,
            -- Seed stable basé sur la semaine pour éviter le favoritisme à chaque run
            MD5(shop_id::text || v_semaine) ASC
        ) AS rang
      FROM shop_scores
      WHERE nb_orders > 0  -- au moins 1 vraie commande cette semaine
    )

    -- Étape 4 : insérer dans vip_rankings (historique)
    INSERT INTO vip_rankings (semaine, shop_id, categorie, rang, score, source)
    SELECT v_semaine, shop_id, category, rang, score, 'auto'
    FROM ranked
    WHERE rang <= v_podium_size;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Étape 5 : mettre à jour is_vip + vip_rank dans shops (top N par catégorie)
    UPDATE shops s
    SET is_vip   = true,
        vip_rank = vr.rang
    FROM vip_rankings vr
    WHERE vr.shop_id = s.id
      AND vr.semaine = v_semaine
      AND vr.source  = 'auto'
      AND vr.rang    <= v_podium_size;

    -- Étape 6 : log de succès
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
    -- Le sous-bloc est rollbacké (is_vip / vip_rankings inchangés).
    -- Ce handler s'exécute dans la transaction EXTERNE — le log d'erreur persiste.
    -- On ne fait pas RAISE car ça rollbackerait aussi ce INSERT.
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

-- Permettre l'appel via RPC depuis service_role
GRANT EXECUTE ON FUNCTION update_vip_rankings(TEXT) TO service_role;

-- ─── 8. ACTIVER pg_cron (lundi 00:00 UTC) ────────────────────────────────────
-- Prérequis : activer pg_cron dans Supabase Dashboard > Database > Extensions
-- Ce bloc ne bloque pas si pg_cron n'est pas encore activé.

DO $cron1$
BEGIN
  -- Supprimer l'ancienne tâche si elle existait
  PERFORM cron.unschedule('lassi-vip-weekly');
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_cron non activé ou tâche inexistante
END $cron1$;

DO $cron2$
BEGIN
  -- Planifier chaque lundi à 00:00 UTC (heure de Dakar = UTC+0)
  PERFORM cron.schedule(
    'lassi-vip-weekly',
    '0 0 * * 1',
    $sql$SELECT update_vip_rankings('cron')$sql$
  );
  RAISE NOTICE 'pg_cron : tâche lassi-vip-weekly planifiée (lundi 00:00 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron non disponible — activer via Supabase Dashboard > Database > Extensions > pg_cron';
END $cron2$;

-- ─── 9. METTRE À JOUR LA VUE shops_effective ─────────────────────────────────
-- DROP + CREATE car les nouvelles colonnes shops (vip_exclu, vip_rank) décalent
-- les colonnes calculées et CREATE OR REPLACE échoue dans ce cas.

DROP VIEW IF EXISTS shops_effective CASCADE;
CREATE VIEW shops_effective AS
  SELECT
    s.*,
    (
      (s.is_vip = TRUE OR (s.vip_manual = TRUE AND (s.vip_manual_until IS NULL OR s.vip_manual_until > NOW())))
      AND s.vip_exclu = FALSE
    ) AS is_effectively_vip,
    (
      s.featured_manual = TRUE
      AND (s.featured_manual_until IS NULL OR s.featured_manual_until > NOW())
    ) AS is_effectively_featured
  FROM shops s;

-- ─── 10. RECHARGER LE SCHEMA CACHE POSTGREST ─────────────────────────────────

NOTIFY pgrst, 'reload schema';
