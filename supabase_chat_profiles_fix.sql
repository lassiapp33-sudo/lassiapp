-- ============================================================
-- LASSI — Fix affichage nom client dans le chat marchand
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ============================================================

-- 1. Fonction RPC sécurisée : lit le nom + avatar d'un utilisateur
--    SECURITY DEFINER = s'exécute avec les droits du propriétaire (postgres),
--    contourne le RLS sans exposer les autres colonnes sensibles (téléphone, email).
CREATE OR REPLACE FUNCTION public.get_profile_by_id(p_user_id UUID)
RETURNS TABLE(full_name TEXT, avatar_url TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name, avatar_url FROM profiles WHERE id = p_user_id;
$$;

-- 2. Accès réservé aux utilisateurs authentifiés uniquement
REVOKE ALL ON FUNCTION public.get_profile_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(UUID) TO authenticated;

-- 3. Politique RLS de lecture des profils pour les utilisateurs authentifiés
--    (fallback si la RPC échoue, et nécessaire pour d'autres lectures de profils)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_read_authenticated'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY profiles_read_authenticated
        ON profiles
        FOR SELECT
        USING (auth.uid() IS NOT NULL)
    $policy$;
  END IF;
END$$;
