-- ===========================================================================
-- LASSI — Section 5 : Rate limiting (anti-bruteforce, anti-spam)
-- ---------------------------------------------------------------------------
-- Table générique rate_limit_buckets + fonction SECURITY DEFINER check_rate_limit()
-- (nommée "_buckets" pour ne pas entrer en collision avec une ancienne table
-- public.rate_limits préexistante, à schéma incompatible et non utilisée par
-- les Edge Functions déployées — laissée intacte par cette migration)
-- utilisée pour limiter :
--   1. Authentification   : 5 tentatives / 15 min, blocage 30 min (téléphone + IP)
--   2. Création de compte : 3 inscriptions / heure / IP
--   3. Création commande  : 20 / heure / utilisateur (Edge Function create-order)
--   4. Envoi de messages  : 100 / heure / utilisateur (trigger sur messages)
--   5. Webhooks reçus     : log si > 100 / heure / payment_intent (webhook-payment)
--
-- Au-delà de la limite → exception ERRCODE 'PT429' → PostgREST renvoie
-- HTTP 429 (Too Many Requests) au client (RPC ou insert direct).
-- ===========================================================================

-- ─── 1. Table rate_limit_buckets ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key           TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ
);

-- RLS activé sans policy : aucun accès direct (anon/authenticated via PostgREST).
-- Seules les fonctions SECURITY DEFINER (propriétaire postgres) y accèdent.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- ─── 2. Fonction check_rate_limit ─────────────────────────────────────────────
-- Compteur glissant atomique : incrémente `count` dans la fenêtre
-- [window_start, window_start + p_window_seconds[. En cas de dépassement de
-- p_max_attempts, bloque pendant p_block_seconds (si > 0) ou jusqu'à la fin
-- de la fenêtre courante (si p_block_seconds = 0).
-- Retourne {allowed, blocked, count, retry_after}.

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
  v_row public.rate_limit_buckets;
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO public.rate_limit_buckets (key, count, window_start)
  VALUES (p_key, 0, v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO v_row FROM public.rate_limit_buckets WHERE key = p_key FOR UPDATE;

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
    UPDATE public.rate_limit_buckets
       SET count = 1, window_start = v_now, blocked_until = NULL
     WHERE key = p_key;
    RETURN jsonb_build_object('allowed', true, 'blocked', false, 'count', 1, 'retry_after', 0);
  END IF;

  -- Limite atteinte dans la fenêtre courante → blocage
  IF v_row.count >= p_max_attempts THEN
    UPDATE public.rate_limit_buckets
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
  UPDATE public.rate_limit_buckets SET count = count + 1 WHERE key = p_key;
  RETURN jsonb_build_object('allowed', true, 'blocked', false, 'count', v_row.count + 1, 'retry_after', 0);
END;
$$;

-- Accès réservé à service_role (Edge Functions) + fonctions SECURITY DEFINER
-- internes (le propriétaire postgres contourne les GRANT). anon/authenticated
-- ne doivent jamais appeler check_rate_limit directement (ils pourraient
-- manipuler les compteurs d'autres utilisateurs).
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- ─── 3. Nettoyage périodique (pg_cron) ────────────────────────────────────────
-- Supprime les compteurs inactifs depuis plus de 24h pour éviter une
-- croissance illimitée de la table.

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_buckets
  WHERE window_start < now() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < now());
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-rate-limits');
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '0 * * * *',   -- toutes les heures
      'SELECT public.cleanup_rate_limits()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;  -- pg_cron non activé : pas bloquant
END;
$$;

-- ─── 4. Authentification : 5 tentatives / 15 min, blocage 30 min ─────────────
-- get_auth_email_by_phone est appelée à CHAQUE tentative de connexion (avant
-- la vérification du mot de passe par Supabase Auth) : c'est le point
-- d'entrée naturel pour limiter par téléphone ET par IP.
-- Dépassement → exception PT429 (PostgREST renvoie HTTP 429).
-- Erreur INATTENDUE dans check_rate_limit (bug, etc.) → fail-open : on
-- n'empêche jamais une connexion légitime, sauf le blocage volontaire PT429
-- qui est toujours propagé.

CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip    TEXT := 'unknown';
  v_email TEXT;
  v_rl    JSONB;
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

  SELECT auth_email INTO v_email FROM public.profiles WHERE phone = p_phone LIMIT 1;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(TEXT) TO anon, authenticated;

-- ─── 5. Création de compte : 3 inscriptions / heure / IP ─────────────────────
-- Nouvelle RPC appelée explicitement par l'app AVANT supabase.auth.signUp().
-- Additive : ne modifie pas le flux d'inscription existant.

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

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_rate_limit() TO anon, authenticated;

-- ─── 6. Envoi de messages : 100 / heure / utilisateur ────────────────────────
-- Trigger BEFORE INSERT sur messages, clé = sender_id (= auth.uid() côté
-- client, même pattern que dispute_messages : sender_id = auth.uid()).

CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rl JSONB;
BEGIN
  v_rl := public.check_rate_limit('messages:' || NEW.sender_id::TEXT, 100, 3600, 0);
  IF NOT (v_rl->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Trop de messages envoyés. Réessaie dans quelques instants.'
      USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_rate_limit ON public.messages;
CREATE TRIGGER trg_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();
