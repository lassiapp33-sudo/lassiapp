-- Supprime la restriction "3 comptes max / IP / heure" à l'inscription.
-- Le tracking des événements et la détection de comptes en masse sont conservés.
CREATE OR REPLACE FUNCTION public.check_signup_rate_limit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT := 'unknown';
BEGIN
  BEGIN
    v_ip := COALESCE(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;

  -- Journalisation + détection masse (non bloquant)
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
