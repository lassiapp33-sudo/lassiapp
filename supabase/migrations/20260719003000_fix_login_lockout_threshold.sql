-- ===========================================================================
-- LASSI — Ajuster le seuil de blocage connexion : 3 → 5 tentatives
-- ---------------------------------------------------------------------------
-- Avant : blocage après 3 échecs consécutifs (trop agressif pour un mauvais mdp)
-- Après : blocage après 5 échecs consécutifs
--   Cycle 1 →  5 min  (5 échecs)
--   Cycle 2 → 10 min  (5 de plus)
--   Cycle 3 → 15 min  (5 de plus)
--   Cycle 4 → PERMANENT
-- ===========================================================================

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

  -- Blocage temporaire encore actif → on ignore
  IF v_lock.locked_until IS NOT NULL AND v_lock.locked_until > now() THEN
    RETURN jsonb_build_object('status', 'still_locked');
  END IF;

  v_new_fails := v_lock.current_fails + 1;

  -- Seuil porté à 5 (était 3)
  IF v_new_fails >= 5 THEN
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
      'remaining', 5 - v_new_fails
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_login_failure(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO anon, authenticated;

-- Vider les blocages actifs qui ont été déclenchés avec l'ancien seuil (3)
-- afin de débloquer immédiatement les comptes bloqués injustement.
DELETE FROM public.login_lockouts
WHERE permanently_blocked = false
  AND (locked_until IS NULL OR locked_until <= now() + interval '15 minutes')
  AND current_fails < 5
  AND lockout_cycle = 0;
