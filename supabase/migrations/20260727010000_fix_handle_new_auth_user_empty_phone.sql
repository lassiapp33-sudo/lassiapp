-- ===========================================================================
-- Fix trigger handle_new_auth_user : phone '' viole la contrainte CHECK
-- ---------------------------------------------------------------------------
-- La contrainte profiles_phone_format_check autorise NULL ou 7[05678][0-9]{7}.
-- COALESCE(phone_meta, '') insère '' si le champ est absent → violation.
-- Fix : utiliser NULLIF pour que '' devienne NULL.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, auth_email, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'),  ''), 'Utilisateur'),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'real_email', '')), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'),  ''), 'client')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
