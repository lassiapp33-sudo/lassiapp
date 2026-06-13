-- ===========================================================================
-- LASSI — Synchronisation auth.users <-> profiles + Realtime admin
-- ---------------------------------------------------------------------------
-- Constat : l'admin (lassi-admin) et l'app lisent tous les deux `profiles`.
--
-- Suppression : déjà garantie par profiles_id_fkey (ON DELETE CASCADE vers
-- auth.users) → supprimer un compte (app ou admin) le retire automatiquement
-- de `profiles`, donc de la liste admin.
--
-- Création : PAS garantie. services/auth.ts:register() crée le compte
-- auth.users puis fait un upsert applicatif dans profiles. Si cet upsert
-- échoue (réseau, RLS, crash juste après signUp), le compte existe dans
-- auth.users mais pas dans profiles → invisible dans l'admin alors qu'il
-- peut se connecter dans l'app.
--
-- Fix 1 : trigger SECURITY DEFINER sur auth.users qui crée systématiquement
-- la ligne profiles à partir de raw_user_meta_data (name/phone/role/
-- real_email), quel que soit le chemin de création. L'upsert applicatif
-- reste pour compléter les champs (avatar, etc.) — ON CONFLICT DO NOTHING
-- ici pour ne jamais écraser des valeurs déjà posées.
--
-- Fix 2 : ajoute `profiles` à la publication Realtime pour que l'admin
-- reflète instantanément les ajouts/suppressions sans recharger la page.
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
    COALESCE(NEW.raw_user_meta_data->>'name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'real_email', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── Realtime sur profiles ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
