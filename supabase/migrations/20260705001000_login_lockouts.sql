-- ===========================================================================
-- LASSI — Blocage progressif des connexions par téléphone
-- ---------------------------------------------------------------------------
-- 3 échecs → 5 min, 3 de plus → 10 min, 3 de plus → 15 min, 3 de plus → PERMANENT
-- Débloqué uniquement par l'admin via admin_unlock_account()
-- ===========================================================================

-- ─── 1. Table login_lockouts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_lockouts (
  phone               TEXT        PRIMARY KEY,
  current_fails       INTEGER     NOT NULL DEFAULT 0,  -- échecs dans le cycle courant (0→2)
  lockout_cycle       INTEGER     NOT NULL DEFAULT 0,  -- nb de cycles de blocage accomplis
  locked_until        TIMESTAMPTZ,                     -- NULL = pas de blocage temporaire actif
  permanently_blocked BOOLEAN     NOT NULL DEFAULT false,
  blocked_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.login_lockouts ENABLE ROW LEVEL SECURITY;
-- Aucune policy publique : seules les fonctions SECURITY DEFINER y accèdent
REVOKE ALL ON public.login_lockouts FROM PUBLIC;
GRANT ALL  ON public.login_lockouts TO service_role;

-- ─── 2. Modifier get_auth_email_by_phone pour vérifier le blocage progressif ─

CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip   TEXT := 'unknown';
  v_email TEXT;
  v_rl   JSONB;
  v_lock public.login_lockouts;
BEGIN
  -- IP pour la protection DDoS
  BEGIN
    v_ip := COALESCE(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  -- Vérifier le blocage progressif par téléphone
  SELECT * INTO v_lock FROM public.login_lockouts WHERE phone = p_phone;
  IF FOUND THEN
    IF v_lock.permanently_blocked THEN
      RAISE EXCEPTION 'Compte bloqué suite à trop de tentatives échouées. Contacte le support LASSI.'
        USING ERRCODE = 'PT403';
    END IF;
    IF v_lock.locked_until IS NOT NULL AND v_lock.locked_until > now() THEN
      RAISE EXCEPTION 'Trop de tentatives. Réessaie dans % minute(s).',
        GREATEST(CEIL(EXTRACT(EPOCH FROM (v_lock.locked_until - now())) / 60), 1)
        USING ERRCODE = 'PT429';
    END IF;
  END IF;

  -- Protection DDoS par IP (seuil élevé, ne remplace pas le blocage par téléphone)
  BEGIN
    v_rl := public.check_rate_limit('login:ip:' || v_ip, 30, 900, 0);
    IF NOT (v_rl->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'Trop de tentatives depuis cet appareil. Réessaie dans quelques minutes.'
        USING ERRCODE = 'PT429';
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'PT429' THEN RAISE;
    WHEN OTHERS THEN NULL; -- fail-open
  END;

  SELECT auth_email INTO v_email FROM public.profiles WHERE phone = p_phone LIMIT 1;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_phone(TEXT) TO anon, authenticated;

-- ─── 3. Enregistrer un échec de connexion ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_login_failure(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock       public.login_lockouts;
  v_new_fails  INTEGER;
  v_new_cycle  INTEGER;
  v_locked_min INTEGER;
BEGIN
  INSERT INTO public.login_lockouts (phone, current_fails, lockout_cycle)
  VALUES (p_phone, 0, 0)
  ON CONFLICT (phone) DO NOTHING;

  SELECT * INTO v_lock FROM public.login_lockouts WHERE phone = p_phone FOR UPDATE;

  -- Déjà bloqué permanent → rien à faire
  IF v_lock.permanently_blocked THEN
    RETURN jsonb_build_object('status', 'permanently_blocked');
  END IF;

  -- Blocage temporaire encore actif → on ignore (l'appel ne devrait pas arriver ici)
  IF v_lock.locked_until IS NOT NULL AND v_lock.locked_until > now() THEN
    RETURN jsonb_build_object('status', 'still_locked');
  END IF;

  v_new_fails := v_lock.current_fails + 1;

  IF v_new_fails >= 3 THEN
    v_new_cycle := v_lock.lockout_cycle + 1;

    IF v_new_cycle >= 4 THEN
      -- 4e cycle = blocage permanent
      UPDATE public.login_lockouts
         SET current_fails       = v_new_fails,
             lockout_cycle       = v_new_cycle,
             locked_until        = NULL,
             permanently_blocked = true,
             blocked_at          = now(),
             updated_at          = now()
       WHERE phone = p_phone;
      RETURN jsonb_build_object('status', 'permanently_blocked');
    ELSE
      -- Cycles 1→3 : 5, 10, 15 minutes
      v_locked_min := v_new_cycle * 5;
      UPDATE public.login_lockouts
         SET current_fails       = 0,
             lockout_cycle       = v_new_cycle,
             locked_until        = now() + make_interval(mins => v_locked_min),
             permanently_blocked = false,
             updated_at          = now()
       WHERE phone = p_phone;
      RETURN jsonb_build_object(
        'status',     'locked',
        'locked_min', v_locked_min,
        'cycle',      v_new_cycle
      );
    END IF;
  ELSE
    -- Pas encore de blocage
    UPDATE public.login_lockouts
       SET current_fails = v_new_fails,
           updated_at    = now()
     WHERE phone = p_phone;
    RETURN jsonb_build_object(
      'status',    'warned',
      'fails',     v_new_fails,
      'remaining', 3 - v_new_fails
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_login_failure(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO anon, authenticated;

-- ─── 4. Réinitialiser le compteur après connexion réussie ─────────────────────

CREATE OR REPLACE FUNCTION public.record_login_success(p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_lockouts WHERE phone = p_phone;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_login_success(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_login_success(TEXT) TO authenticated;

-- ─── 5. Déblocage par l'admin ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_unlock_account(p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = 'PT403';
  END IF;

  DELETE FROM public.login_lockouts WHERE phone = p_phone;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_unlock_account(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_unlock_account(TEXT) TO authenticated;

-- ─── 6. Lister les comptes bloqués (admin) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_locked_accounts()
RETURNS TABLE (
  phone               TEXT,
  current_fails       INTEGER,
  lockout_cycle       INTEGER,
  locked_until        TIMESTAMPTZ,
  permanently_blocked BOOLEAN,
  blocked_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = 'PT403';
  END IF;

  RETURN QUERY
  SELECT
    l.phone, l.current_fails, l.lockout_cycle,
    l.locked_until, l.permanently_blocked, l.blocked_at, l.updated_at
  FROM public.login_lockouts l
  WHERE
    l.permanently_blocked = true
    OR (l.locked_until IS NOT NULL AND l.locked_until > now())
    OR l.current_fails > 0
  ORDER BY l.permanently_blocked DESC, l.blocked_at DESC NULLS LAST, l.updated_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_locked_accounts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_locked_accounts() TO authenticated;
