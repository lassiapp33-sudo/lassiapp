-- ===========================================================================
-- LASSI — Section 6 : Détection d'anomalies (anti-fraude basique)
-- ---------------------------------------------------------------------------
-- Table générique fraud_flags + helper raise_fraud_flag(), et 5 détections :
--   1. Wash trading      : même client > 10 commandes / 24h chez le même
--                           commerçant avec montants similaires → flag + shop
--                           exclu du scoring VIP (vip_exclu = TRUE)
--   2. Comptes en masse   : > 5 inscriptions / heure / IP → flag (ip)
--   3. Pics anormaux      : commerçant > 50 commandes / 1h alors qu'il en
--                           avait 0 dans les 24h précédentes → flag + shop
--                           exclu du scoring VIP
--   4. Montants suspects  : commande > 100 000 F → flag (vérification manuelle)
--   5. Pattern attaquant  : bruteforce login récent + tentative de
--                           manipulation de montant (webhook disputed) →
--                           flag critique + suspension temporaire du compte
--
-- Les commandes/comptes flaggés (target_type 'order' ou 'profile', status
-- 'open') sont exclus de update_vip_rankings(). Le tout est consultable
-- depuis le dashboard admin via la table fraud_flags (RLS admin uniquement).
-- ===========================================================================

-- ─── 1. Table fraud_flags + helper raise_fraud_flag ──────────────────────────

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN (
                 'wash_trading', 'mass_signup', 'order_spike',
                 'high_amount', 'attacker_pattern'
               )),
  target_type TEXT NOT NULL CHECK (target_type IN ('order', 'profile', 'shop', 'ip')),
  target_id   TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'confirmed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fraud_flags_type_target_idx ON public.fraud_flags (type, target_type, target_id);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx ON public.fraud_flags (status, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_open_lookup_idx ON public.fraud_flags (target_type, target_id) WHERE status = 'open';

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY fraud_flags_admin_all ON public.fraud_flags FOR ALL
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insère un flag, sauf s'il existe déjà un flag équivalent ouvert et récent
-- (déduplication — évite le bruit en cas de détections répétées).
CREATE OR REPLACE FUNCTION public.raise_fraud_flag(
  p_type          TEXT,
  p_target_type   TEXT,
  p_target_id     TEXT,
  p_severity      TEXT,
  p_details       JSONB,
  p_dedupe_window INTERVAL DEFAULT INTERVAL '1 hour'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fraud_flags (type, target_type, target_id, severity, details)
  SELECT p_type, p_target_type, p_target_id, p_severity, p_details
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fraud_flags
    WHERE type        = p_type
      AND target_type = p_target_type
      AND target_id   = p_target_id
      AND status      = 'open'
      AND created_at  >= now() - p_dedupe_window
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.raise_fraud_flag(TEXT, TEXT, TEXT, TEXT, JSONB, INTERVAL) FROM PUBLIC;

-- ─── 2. Comptes en masse : > 5 inscriptions / heure / IP ─────────────────────
-- signup_events est alimentée par check_signup_rate_limit() (Section 5),
-- déjà appelée via RPC PostgREST avant supabase.auth.signUp() — c'est le seul
-- point où l'IP du demandeur (request.headers) est disponible de façon fiable.

CREATE TABLE IF NOT EXISTS public.signup_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_events_ip_created_idx ON public.signup_events (ip, created_at);

-- RLS activé sans policy : aucun accès direct, uniquement via fonctions
-- SECURITY DEFINER (propriétaire postgres).
ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.detect_mass_signup(p_ip TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_ip IS NULL OR p_ip = 'unknown' THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.signup_events
  WHERE ip = p_ip AND created_at >= now() - INTERVAL '1 hour';

  IF v_count > 5 THEN
    PERFORM public.raise_fraud_flag(
      'mass_signup', 'ip', p_ip, 'high',
      jsonb_build_object('count', v_count, 'window', '1h')
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_mass_signup(TEXT) FROM PUBLIC;

-- check_signup_rate_limit (révision Section 6) : journalise l'IP de la
-- tentative d'inscription puis lance la détection de comptes en masse.
-- Échec non bloquant — ne doit jamais empêcher une inscription légitime.
CREATE OR REPLACE FUNCTION public.check_signup_rate_limit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT := 'unknown';
  v_rl JSONB;
BEGIN
  BEGIN
    v_ip := COALESCE(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  BEGIN
    v_rl := public.check_rate_limit('signup:ip:' || v_ip, 3, 3600, 0);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de comptes créés depuis cet appareil. Réessaie dans une heure.'
        USING ERRCODE = 'PT429';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'PT429' THEN
      RAISE;
    WHEN OTHERS THEN
      NULL; -- échec inattendu : ne jamais bloquer une inscription légitime
  END;

  -- Section 6 : détection de comptes en masse (> 5 inscriptions / IP / heure)
  BEGIN
    INSERT INTO public.signup_events (ip) VALUES (v_ip);
    PERFORM public.detect_mass_signup(v_ip);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_rate_limit() TO anon, authenticated;

-- ─── 3. Wash trading (commandes circulaires) ─────────────────────────────────
-- Même client > 10 commandes / 24h chez le même commerçant, montants
-- similaires (écart-type ≤ 15 % de la moyenne) → flag + shop exclu du VIP.
-- Exécuté périodiquement via pg_cron (toutes les heures).

CREATE OR REPLACE FUNCTION public.detect_wash_trading()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      o.shop_id,
      o.client_id,
      COUNT(*)        AS nb,
      AVG(o.total)    AS avg_total,
      STDDEV(o.total) AS stddev_total
    FROM public.orders o
    WHERE o.created_at >= now() - INTERVAL '24 hours'
      AND o.client_id IS NOT NULL
    GROUP BY o.shop_id, o.client_id
    HAVING COUNT(*) > 10
       AND COALESCE(STDDEV(o.total), 0) <= AVG(o.total) * 0.15
  LOOP
    PERFORM public.raise_fraud_flag(
      'wash_trading', 'shop', r.shop_id::text, 'high',
      jsonb_build_object(
        'client_id',  r.client_id,
        'orders_24h', r.nb,
        'avg_total',  round(r.avg_total),
        'window',     '24h'
      ),
      INTERVAL '24 hours'
    );

    -- Exclusion immédiate du scoring VIP (appel direct DB → auth.role() IS NULL)
    UPDATE public.shops SET vip_exclu = TRUE WHERE id = r.shop_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_wash_trading() FROM PUBLIC;

DO $$ BEGIN
  PERFORM cron.unschedule('detect-wash-trading');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.schedule(
    'detect-wash-trading',
    '0 * * * *',  -- toutes les heures
    'SELECT public.detect_wash_trading()'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── 4. Pics anormaux de commandes ────────────────────────────────────────────
-- Commerçant qui reçoit > 50 commandes en 1h alors qu'il en avait 0 dans les
-- 24h précédentes → flag + shop exclu du VIP.
-- Exécuté périodiquement via pg_cron (toutes les 15 minutes).

CREATE OR REPLACE FUNCTION public.detect_order_spikes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.shop_id, COUNT(*) AS nb
    FROM public.orders o
    WHERE o.created_at >= now() - INTERVAL '1 hour'
    GROUP BY o.shop_id
    HAVING COUNT(*) > 50
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o2
      WHERE o2.shop_id = r.shop_id
        AND o2.created_at >= now() - INTERVAL '25 hours'
        AND o2.created_at <  now() - INTERVAL '1 hour'
    ) THEN
      PERFORM public.raise_fraud_flag(
        'order_spike', 'shop', r.shop_id::text, 'high',
        jsonb_build_object('orders_last_hour', r.nb, 'window', '1h')
      );

      -- Exclusion immédiate du scoring VIP (appel direct DB → auth.role() IS NULL)
      UPDATE public.shops SET vip_exclu = TRUE WHERE id = r.shop_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_order_spikes() FROM PUBLIC;

DO $$ BEGIN
  PERFORM cron.unschedule('detect-order-spikes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.schedule(
    'detect-order-spikes',
    '*/15 * * * *',  -- toutes les 15 minutes
    'SELECT public.detect_order_spikes()'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── 5. Montants suspects (> 100 000 F) ──────────────────────────────────────
-- Hook dans create_order_atomic : flag non bloquant sur la commande créée,
-- pour vérification manuelle par un admin.

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_shop_id         UUID,
  p_client_id       UUID,
  p_client_name     TEXT,
  p_total           NUMERIC,
  p_discount_amount NUMERIC,
  p_promo_label     TEXT,
  p_order_type      TEXT,
  p_note            TEXT,
  p_idempotency_key TEXT,
  p_items           JSONB   -- [{ product_name, qty, unit_price }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- ① Insérer la commande
  INSERT INTO orders (
    shop_id, client_id, client_name,
    total, discount_amount, promo_label,
    status, pay_method, order_type,
    note, idempotency_key
  )
  VALUES (
    p_shop_id, p_client_id, p_client_name,
    p_total, p_discount_amount, p_promo_label,
    'pending', 'wave', p_order_type,
    p_note, p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ② Insérer les articles (même transaction — rollback auto si erreur)
  INSERT INTO order_items (order_id, product_name, qty, unit_price)
  SELECT
    v_order_id,
    (item ->> 'product_name')::TEXT,
    (item ->> 'qty')::INTEGER,
    (item ->> 'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  -- ③ Section 6 : montant suspect (> 100 000 F) → flag pour vérification manuelle
  IF p_total > 100000 THEN
    PERFORM public.raise_fraud_flag(
      'high_amount', 'order', v_order_id::text, 'medium',
      jsonb_build_object('total', p_total, 'shop_id', p_shop_id, 'client_id', p_client_id)
    );
  END IF;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;

-- ─── 6. Pattern attaquant : bruteforce + manipulation de montant ─────────────
-- Si un paiement est "disputed" (montant reçu ≠ montant attendu — Section 3.2)
-- ET que ce client a récemment été bloqué pour bruteforce sur la connexion
-- (Section 5, rate_limit_buckets 'login:phone:...'), c'est un faisceau d'indices
-- d'attaque coordonnée → flag critique + suspension temporaire 24h du compte.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.detect_attacker_pattern(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone   TEXT;
  v_blocked BOOLEAN := FALSE;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT phone INTO v_phone FROM public.profiles WHERE id = p_client_id;

  IF v_phone IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rate_limit_buckets
      WHERE key = 'login:phone:' || v_phone
        AND blocked_until IS NOT NULL
        AND blocked_until > now() - INTERVAL '1 hour'
    ) INTO v_blocked;
  END IF;

  IF v_blocked THEN
    PERFORM public.raise_fraud_flag(
      'attacker_pattern', 'profile', p_client_id::text, 'critical',
      jsonb_build_object('reason', 'login_bruteforce_then_amount_manipulation'),
      INTERVAL '24 hours'
    );

    UPDATE public.profiles
       SET suspended_until = now() + INTERVAL '24 hours'
     WHERE id = p_client_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_attacker_pattern(UUID) FROM PUBLIC;

-- ─── 7. process_payment_webhook (révision Section 6) ─────────────────────────
-- Identique à la version Section 3.2, avec un appel à detect_attacker_pattern
-- dans la branche 'disputed' (tentative de manipulation de montant).

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_external_event_id TEXT,
  p_payment_intent_id UUID,
  p_source            TEXT,
  p_external_status   TEXT,
  p_external_ref      TEXT,
  p_received_amount   INTEGER,
  p_is_success        BOOLEAN,
  p_raw_payload       JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pi     payment_intents%ROWTYPE;
  v_log_id UUID;
  v_confirm JSONB;
BEGIN
  -- Recharger + verrouiller le payment_intent AVANT toute écriture dans
  -- payment_logs (contrainte FK : impossible de logguer un id inexistant)
  SELECT * INTO v_pi FROM payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- 3. Idempotence : un même événement Wave/OM ne doit être traité qu'une fois
  --    (les webhooks peuvent être renvoyés plusieurs fois par le fournisseur)
  INSERT INTO payment_logs (payment_intent_id, event_type, event_data, external_event_id)
  VALUES (
    p_payment_intent_id, 'webhook_received',
    jsonb_build_object('source', p_source, 'status', p_external_status, 'payload', p_raw_payload),
    p_external_event_id
  )
  ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_log_id;

  IF v_log_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- 5. Anti-rejeu : on ne traite que les paiements encore en attente
  IF v_pi.statut NOT IN ('pending', 'initiated') THEN
    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'webhook_ignored',
            jsonb_build_object('reason', 'not_pending', 'statut', v_pi.statut, 'source', p_source));

    RETURN jsonb_build_object('ok', true, 'ignored', true, 'reason', 'not_pending', 'statut', v_pi.statut);
  END IF;

  -- Échec côté fournisseur (paiement annulé / refusé)
  IF NOT p_is_success THEN
    UPDATE payment_intents SET
      statut          = 'failed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'failed',
            jsonb_build_object('source', p_source, 'external_status', p_external_status));

    RETURN jsonb_build_object('ok', true, 'statut', 'failed');
  END IF;

  -- 4. Vérification du montant reçu vs montant attendu, au FCFA près.
  --    Écart → 'disputed', pas de reversement, à trancher par un admin.
  IF p_received_amount IS NOT NULL AND p_received_amount <> v_pi.montant_total THEN
    UPDATE payment_intents SET
      statut          = 'disputed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'disputed',
            jsonb_build_object('source', p_source, 'expected', v_pi.montant_total, 'received', p_received_amount));

    -- Section 6 : pattern attaquant — bruteforce login récent + manipulation de montant
    PERFORM public.detect_attacker_pattern(v_pi.client_id);

    RETURN jsonb_build_object('ok', false, 'disputed', true, 'expected', v_pi.montant_total, 'received', p_received_amount);
  END IF;

  -- 6. Succès confirmé : transition + activation commande/réservation + payout_queue,
  --    le tout dans cette même transaction (atomicité garantie par Postgres)
  UPDATE payment_intents SET
    statut          = 'confirmed',
    external_status = p_external_status,
    external_ref    = COALESCE(p_external_ref, external_ref),
    confirmed_at    = now(),
    updated_at      = now()
  WHERE id = p_payment_intent_id;

  v_confirm := public.confirm_order_from_payment(p_payment_intent_id);

  RETURN jsonb_build_object('ok', true, 'statut', 'confirmed') || v_confirm;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB) TO service_role;

-- ─── 8. get_auth_email_by_phone (révision Section 6) ─────────────────────────
-- Identique à la version Section 5 (rate limiting), avec en plus : si le
-- compte est temporairement suspendu (suspended_until > now()) → PT403.

CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip              TEXT := 'unknown';
  v_email           TEXT;
  v_suspended_until TIMESTAMPTZ;
  v_rl              JSONB;
BEGIN
  BEGIN
    v_ip := COALESCE(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  BEGIN
    v_rl := public.check_rate_limit('login:phone:' || COALESCE(p_phone, ''), 5, 900, 1800);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de tentatives de connexion. Réessaie dans % minute(s).',
        GREATEST(CEIL((v_rl->>'retry_after')::NUMERIC / 60), 1)
        USING ERRCODE = 'PT429';
    END IF;

    v_rl := public.check_rate_limit('login:ip:' || v_ip, 5, 900, 1800);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de tentatives de connexion depuis cet appareil. Réessaie dans % minute(s).',
        GREATEST(CEIL((v_rl->>'retry_after')::NUMERIC / 60), 1)
        USING ERRCODE = 'PT429';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'PT429' THEN
      RAISE;
    WHEN OTHERS THEN
      NULL; -- échec inattendu du rate limiting : ne jamais bloquer une connexion légitime
  END;

  SELECT auth_email, suspended_until INTO v_email, v_suspended_until
  FROM public.profiles WHERE phone = p_phone LIMIT 1;

  -- Section 6 : compte suspendu suite à un pattern attaquant détecté
  IF v_suspended_until IS NOT NULL AND v_suspended_until > now() THEN
    RAISE EXCEPTION 'Compte temporairement suspendu pour activité suspecte. Réessaie après % (heure de Dakar).',
      to_char(v_suspended_until AT TIME ZONE 'Africa/Dakar', 'HH24:MI')
      USING ERRCODE = 'PT403';
  END IF;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(TEXT) TO anon, authenticated;

-- ─── 9. update_vip_rankings (révision Section 6) ─────────────────────────────
-- Identique à la version Section "VIP system v2", avec en plus : exclusion
-- des commandes/comptes flaggés (fraud_flags, status = 'open') de
-- eligible_orders.

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
    -- + non flaggées comme frauduleuses (Section 6)
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
        AND NOT EXISTS (
          SELECT 1 FROM fraud_flags ff
          WHERE ff.status = 'open'
            AND (
              (ff.target_type = 'order'   AND ff.target_id = o.id::text) OR
              (ff.target_type = 'profile' AND ff.target_id = o.client_id::text)
            )
        )
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

GRANT EXECUTE ON FUNCTION update_vip_rankings(TEXT) TO service_role;

-- ─── 10. RECHARGER LE SCHEMA CACHE POSTGREST ─────────────────────────────────

NOTIFY pgrst, 'reload schema';
