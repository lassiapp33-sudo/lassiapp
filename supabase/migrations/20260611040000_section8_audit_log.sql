-- ===========================================================================
-- LASSI — Section 8 : Logs & Audit Trail (traçabilité totale)
-- ---------------------------------------------------------------------------
-- audit_log : journal immuable, append-only, de toute action sensible.
--   - Authentifications    : connexion réussie/échouée, déconnexion (app + admin)
--   - Données sensibles    : création/modification/suppression de profil,
--                            commande, paiement (trigger générique) et
--                            changement de prix produit (trigger dédié)
--   - Actions admin        : suppression/ban de compte, VIP manuel
--                            (exclusion + réglages), mise en avant manuelle
--   - Tentatives suspectes : seuil de rate limit atteint (login/signup/...),
--                            suspension automatique (pattern attaquant),
--                            signature webhook invalide
--
-- Note transactionnelle importante : un appel RPC qui se termine par
-- RAISE EXCEPTION (ex : PT429/PT403) annule TOUTE la transaction en cours, y
-- compris les INSERT déjà effectués (le bloc PL/pgSQL EXCEPTION qui capture
-- l'erreur revient à un savepoint antérieur). On ne peut donc PAS journaliser
-- un événement "juste avant" de lever une telle exception — l'entrée serait
-- perdue silencieusement. C'est pourquoi :
--   - "rate limit dépassé" est journalisé dans check_rate_limit() au moment
--     où le seuil est ATTEINT (la dernière tentative encore autorisée, qui
--     retourne normalement et committe), et non dans la branche bloquée
--     (qui ne committe jamais).
--   - "compte suspendu" est journalisé au moment où detect_attacker_pattern()
--     POSE la suspension (depuis process_payment_webhook, qui retourne
--     normalement), et non à chaque tentative de connexion bloquée par PT403.
--   - "numéro introuvable" (get_auth_email_by_phone) ne lève PAS d'exception
--     → journalisable directement.
-- ===========================================================================

-- ─── 1. Table audit_log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     UUID,
  actor_role   TEXT,
  ip_address   TEXT,
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    TEXT,
  before_data  JSONB,
  after_data   JSONB,
  metadata     JSONB
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx       ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx      ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx      ON public.audit_log (target_table, target_id);

-- IMMUABLE : aucune modification ni suppression possible (append-only),
-- même pattern que payment_logs (Section 3).
DO $$ BEGIN
  DROP RULE IF EXISTS audit_log_no_update ON public.audit_log;
  CREATE RULE audit_log_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP RULE IF EXISTS audit_log_no_delete ON public.audit_log;
  CREATE RULE audit_log_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- RLS : lecture admin uniquement. Aucune policy INSERT/UPDATE/DELETE pour
-- anon/authenticated → seules les fonctions SECURITY DEFINER (propriétaire
-- postgres, qui contourne la RLS) peuvent écrire, via log_audit_event().
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ─── 2. log_audit_event : point d'entrée unique pour écrire dans audit_log ───
-- Résolution de l'acteur :
--   - service_role + p_actor_id fourni → Edge Function admin-* qui a déjà
--     vérifié l'identité de l'admin via JWT : on fait confiance à p_actor_id.
--   - sinon → p_actor_id/p_actor_role sont ignorés (jamais fiables venant
--     d'un appelant anon/authenticated) et on utilise l'identité JWT de la
--     requête (auth.uid() / auth.role()).
-- N'échoue jamais : une erreur de journalisation ne doit jamais bloquer
-- l'opération métier qui l'a déclenchée.

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action       TEXT,
  p_target_table TEXT  DEFAULT NULL,
  p_target_id    TEXT  DEFAULT NULL,
  p_before       JSONB DEFAULT NULL,
  p_after        JSONB DEFAULT NULL,
  p_metadata     JSONB DEFAULT NULL,
  p_actor_id     UUID  DEFAULT NULL,
  p_actor_role   TEXT  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_role TEXT;
  v_ip         TEXT := 'unknown';
BEGIN
  IF p_actor_id IS NOT NULL AND auth.role() = 'service_role' THEN
    v_actor_id   := p_actor_id;
    v_actor_role := COALESCE(p_actor_role, 'admin');
  ELSE
    v_actor_id   := auth.uid();
    v_actor_role := COALESCE(p_actor_role, auth.role(), 'anon');
  END IF;

  BEGIN
    v_ip := COALESCE(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown');
  EXCEPTION WHEN OTHERS THEN v_ip := 'unknown'; END;

  INSERT INTO public.audit_log
    (actor_id, actor_role, ip_address, action, target_table, target_id, before_data, after_data, metadata)
  VALUES
    (v_actor_id, v_actor_role, v_ip, p_action, p_target_table, p_target_id, p_before, p_after, p_metadata);
EXCEPTION WHEN OTHERS THEN
  NULL; -- la journalisation ne doit jamais faire échouer l'opération appelante
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, UUID, TEXT) TO authenticated, service_role;

-- ─── 3. audit_row_change : trigger générique (profiles, orders, payment_intents) ─
-- Capture before/after complets de la ligne pour toute création/modification/
-- suppression. Couvre notamment le changement de numéro Wave (profiles.phone).

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_audit_event(
    TG_TABLE_NAME || '_' || lower(TG_OP),
    TG_TABLE_NAME,
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END,
    NULL
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_profiles_change ON public.profiles;
CREATE TRIGGER audit_profiles_change
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_orders_change ON public.orders;
CREATE TRIGGER audit_orders_change
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_payment_intents_change ON public.payment_intents;
CREATE TRIGGER audit_payment_intents_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ─── 4. audit_products_change : changement de prix (données financières) ─────
-- INSERT/DELETE toujours journalisés (ligne complète) ; UPDATE uniquement si
-- le prix a changé (avant/après).

CREATE OR REPLACE FUNCTION public.audit_products_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.price IS NOT DISTINCT FROM NEW.price THEN
      RETURN NEW;
    END IF;
    PERFORM public.log_audit_event(
      'products_price_change', 'products', NEW.id::TEXT,
      jsonb_build_object('price', OLD.price),
      jsonb_build_object('price', NEW.price),
      NULL
    );
    RETURN NEW;
  END IF;

  PERFORM public.log_audit_event(
    'products_' || lower(TG_OP), 'products',
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END,
    NULL
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_products_change ON public.products;
CREATE TRIGGER audit_products_change
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_products_change();

-- ─── 5. check_rate_limit (révision Section 8) ────────────────────────────────
-- Identique à la version Section 5, + journalisation "rate_limit_reached"
-- au moment où le seuil est ATTEINT (voir note transactionnelle en tête de
-- fichier — c'est le seul moment où l'écriture committe réellement).

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_max_attempts   INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds  INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limits;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
  VALUES (p_key, 0, v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  -- Blocage explicite encore actif
  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed',     false,
      'blocked',     true,
      'count',       v_row.count,
      'retry_after', CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INT
    );
  END IF;

  -- Fenêtre expirée → nouvelle fenêtre
  IF v_row.window_start <= v_now - (p_window_seconds || ' seconds')::INTERVAL THEN
    UPDATE public.rate_limits
       SET count = 1, window_start = v_now, blocked_until = NULL
     WHERE key = p_key;
    RETURN jsonb_build_object('allowed', true, 'blocked', false, 'count', 1, 'retry_after', 0);
  END IF;

  -- Limite atteinte dans la fenêtre courante → blocage
  IF v_row.count >= p_max_attempts THEN
    UPDATE public.rate_limits
       SET count = count + 1,
           blocked_until = CASE WHEN p_block_seconds > 0
                                 THEN v_now + (p_block_seconds || ' seconds')::INTERVAL
                                 ELSE blocked_until END
     WHERE key = p_key;
    RETURN jsonb_build_object(
      'allowed',     false,
      'blocked',     p_block_seconds > 0,
      'count',       v_row.count + 1,
      'retry_after', CASE
                        WHEN p_block_seconds > 0 THEN p_block_seconds
                        ELSE GREATEST(CEIL(EXTRACT(EPOCH FROM (
                          v_row.window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now
                        )))::INT, 1)
                      END
    );
  END IF;

  -- Dans les clous : incrémenter
  UPDATE public.rate_limits SET count = count + 1 WHERE key = p_key;

  -- Section 8 : la limite vient d'être atteinte sur CETTE tentative (encore
  -- autorisée) → journaliser maintenant, pendant que la transaction committe
  -- normalement. Toute tentative suivante sera bloquée par la branche
  -- ci-dessus, qui ne committe jamais.
  IF v_row.count + 1 >= p_max_attempts THEN
    PERFORM public.log_audit_event(
      'rate_limit_reached', 'rate_limits', p_key, NULL,
      jsonb_build_object('count', v_row.count + 1, 'max_attempts', p_max_attempts,
                          'window_seconds', p_window_seconds, 'block_seconds', p_block_seconds),
      NULL
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'blocked', false, 'count', v_row.count + 1, 'retry_after', 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- ─── 6. detect_attacker_pattern (révision Section 8) ─────────────────────────
-- Identique à la version Section 6, + journalisation "account_suspended" au
-- moment où la suspension est posée (process_payment_webhook ne lève pas
-- d'exception → cette écriture committe normalement).

CREATE OR REPLACE FUNCTION public.detect_attacker_pattern(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone   TEXT;
  v_blocked BOOLEAN := FALSE;
  v_until   TIMESTAMPTZ;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT phone INTO v_phone FROM public.profiles WHERE id = p_client_id;

  IF v_phone IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rate_limits
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

    v_until := now() + INTERVAL '24 hours';
    UPDATE public.profiles
       SET suspended_until = v_until
     WHERE id = p_client_id;

    PERFORM public.log_audit_event(
      'account_suspended', 'profiles', p_client_id::TEXT, NULL,
      jsonb_build_object('suspended_until', v_until),
      jsonb_build_object('reason', 'login_bruteforce_then_amount_manipulation')
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_attacker_pattern(UUID) FROM PUBLIC;

-- ─── 7. get_auth_email_by_phone (révision Section 8) ─────────────────────────
-- Identique à la version Section 6, + journalisation "login_failed_unknown_phone"
-- (cette branche ne lève pas d'exception → journalisable directement, voir
-- note en tête de fichier pour PT429/PT403).

CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ip              TEXT := 'unknown';
  v_email           TEXT;
  v_suspended_until TIMESTAMPTZ;
  v_rl              JSONB;
BEGIN
  BEGIN
    v_ip := COALESCE(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown');
  EXCEPTION WHEN OTHERS THEN v_ip := 'unknown'; END;

  BEGIN
    v_rl := public.check_rate_limit('login:phone:' || COALESCE(p_phone, ''), 5, 900, 1800);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de tentatives de connexion. Réessaie dans % minute(s).',
        GREATEST(CEIL((v_rl->>'retry_after')::NUMERIC / 60), 1) USING ERRCODE = 'PT429';
    END IF;
    v_rl := public.check_rate_limit('login:ip:' || v_ip, 5, 900, 1800);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de tentatives de connexion depuis cet appareil. Réessaie dans % minute(s).',
        GREATEST(CEIL((v_rl->>'retry_after')::NUMERIC / 60), 1) USING ERRCODE = 'PT429';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'PT429' THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;

  SELECT auth_email, suspended_until INTO v_email, v_suspended_until
  FROM public.profiles WHERE phone = p_phone LIMIT 1;

  IF v_suspended_until IS NOT NULL AND v_suspended_until > now() THEN
    RAISE EXCEPTION 'Compte temporairement suspendu pour activité suspecte. Réessaie après % (heure de Dakar).',
      to_char(v_suspended_until AT TIME ZONE 'Africa/Dakar', 'HH24:MI') USING ERRCODE = 'PT403';
  END IF;

  IF v_email IS NULL THEN
    PERFORM public.log_audit_event(
      'login_failed_unknown_phone', 'profiles', p_phone, NULL, NULL,
      jsonb_build_object('ip', v_ip)
    );
  END IF;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(TEXT) TO anon, authenticated;
