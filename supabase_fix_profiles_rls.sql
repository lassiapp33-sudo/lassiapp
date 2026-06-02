-- Permet à tout utilisateur authentifié de lire le nom et l'avatar d'un autre profil.
-- Sans cette politique, un marchand ne peut pas lire le profil d'un client (bug "..." dans le chat).
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor

CREATE POLICY IF NOT EXISTS "profiles_read_authenticated"
  ON profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
