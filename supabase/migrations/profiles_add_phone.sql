-- ─── Fix bouton appel dans le chat ───────────────────────────────────────────
-- 1. Ajouter la colonne phone dans profiles (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Backfill depuis raw_user_meta_data (inscription via l'app)
UPDATE profiles p
SET phone = (u.raw_user_meta_data->>'phone')
FROM auth.users u
WHERE p.id = u.id
  AND p.phone IS NULL
  AND u.raw_user_meta_data->>'phone' IS NOT NULL;

-- 3. Mettre à jour la RPC get_profile_by_id pour inclure phone
--    (DROP obligatoire car le type de retour change)
DROP FUNCTION IF EXISTS public.get_profile_by_id(UUID);

CREATE FUNCTION public.get_profile_by_id(p_user_id UUID)
RETURNS TABLE(full_name TEXT, avatar_url TEXT, phone TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name, avatar_url, phone FROM profiles WHERE id = p_user_id;
$$;

REVOKE ALL    ON FUNCTION public.get_profile_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(UUID) TO authenticated;
