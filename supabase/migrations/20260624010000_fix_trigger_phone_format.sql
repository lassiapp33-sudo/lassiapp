-- ===========================================================================
-- LASSİ — Fix trigger création profil : normalisation numéro de téléphone
-- ---------------------------------------------------------------------------
-- Bug : handle_new_auth_user() utilisait COALESCE(phone, '') qui donne une
-- chaîne vide '' pour les téléphones absents. La contrainte NOT VALID sur
-- profiles.phone (CHECK phone IS NULL OR phone ~ '^7[05678][0-9]{7}$')
-- rejette les chaînes vides → trigger échoue → inscription échoue.
--
-- Autre cas : numéro avec préfixe +221/221 ou espaces (ex: "+221771234567")
-- → ne correspond pas à '^7[05678][0-9]{7}$' → trigger échoue.
--
-- Fix : normaliser le numéro avant insertion :
--   1. Supprimer espaces et tirets
--   2. Supprimer préfixe +221 / 221
--   3. Vérifier le format sénégalais 7[05678]XXXXXXX (9 chiffres)
--   4. Si invalide ou vide → NULL (la contrainte autorise NULL)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.normalize_senegal_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
    RETURN NULL;
  END IF;

  -- Supprimer espaces, tirets, parenthèses
  v_clean := REGEXP_REPLACE(TRIM(p_phone), '[\s\-\(\)]', '', 'g');

  -- Supprimer préfixe international +221 ou 221
  IF v_clean LIKE '+221%' THEN
    v_clean := SUBSTRING(v_clean FROM 5);
  ELSIF v_clean LIKE '221%' AND LENGTH(v_clean) = 12 THEN
    v_clean := SUBSTRING(v_clean FROM 4);
  END IF;

  -- Valider le format sénégalais (9 chiffres, préfixe 7[05678])
  IF v_clean ~ '^7[05678][0-9]{7}$' THEN
    RETURN v_clean;
  END IF;

  -- Format invalide → NULL (laisse la contrainte passer)
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_senegal_phone(TEXT) TO authenticated, service_role;


-- ── Trigger recréé avec normalisation téléphone ──────────────────────────────

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
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), 'Utilisateur'),
    public.normalize_senegal_phone(NEW.raw_user_meta_data->>'phone'),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'real_email', '')), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'client')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Le trigger existant est automatiquement mis à jour (CREATE OR REPLACE Function)
-- → pas besoin de recréer le trigger lui-même.


-- ── Backfill : auth.users sans profil (inscription ratée avant ce fix) ───────

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, name, phone, auth_email, email, role)
  SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Utilisateur'),
    public.normalize_senegal_phone(u.raw_user_meta_data->>'phone'),
    u.email,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'real_email', '')), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'role'), ''), 'client')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profils créés par backfill : %', v_count;
END $$;


-- ── Normaliser les téléphones existants (profils déjà créés avec +221) ───────

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET phone = public.normalize_senegal_phone(phone)
  WHERE phone IS NOT NULL
    AND phone NOT SIMILAR TO '7[05678][0-9]{7}';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profils existants mis à jour (normalisation phone) : %', v_count;
END $$;
