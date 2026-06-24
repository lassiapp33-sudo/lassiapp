-- ===========================================================================
-- LASSİ — Fix synchronisation suppression utilisateurs + nettoyage orphelins
-- Migration 2026-06-24
-- ===========================================================================
-- Problèmes résolus :
--
--  1. SUPPRESSIONS : quand un utilisateur supprime son compte via l'app,
--     la fonction delete-account tentait de supprimer le profil mais
--     échouait si des DISPUTES référençaient reporter_id / against_id
--     (NOT NULL → la cascade est bloquée). Résultat : le profil restait
--     dans la DB et continuait d'apparaître dans le dashboard admin.
--
--     Fix : trigger BEFORE DELETE sur auth.users qui :
--       a) supprime les disputes impliquant cet utilisateur
--       b) supprime les messages de litige orphelins
--       c) laisse ensuite la cascade profiles_id_fkey faire son travail
--
--  2. BACKFILL : auth.users créés sans ligne profiles correspondante
--     (trigger absent lors de l'inscription, ou upsert applicatif échoué).
--     Ces utilisateurs peuvent se connecter dans l'app mais sont invisibles
--     dans le dashboard admin.
--
--     Fix : INSERT ... ON CONFLICT DO NOTHING pour tous les auth.users
--     récents (< 90 jours) sans profil.
--
--  3. ORPHELINS : profils dont le auth.users correspondant n'existe plus
--     (compte supprimé depuis le dashboard Supabase ou via une Edge Function
--     qui a sauté l'étape profiles).
--
--     Fix : DELETE des profils orphelins.
-- ===========================================================================

-- ── 1. Trigger BEFORE DELETE sur auth.users ──────────────────────────────────
--    Nettoie les disputes et messages de litige AVANT que la cascade
--    profiles_id_fkey tente de supprimer le profil.
--    Sans ça, la suppression de profil échoue sur la contrainte NOT NULL
--    de disputes.reporter_id / disputes.against_id.

CREATE OR REPLACE FUNCTION public.handle_auth_user_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1a. Litiges où cet utilisateur est reporter ou against.
  --     reporter_id / against_id sont NOT NULL → impossible de SET NULL,
  --     on supprime le litige (cascade → dispute_messages via ON DELETE CASCADE).
  DELETE FROM disputes
  WHERE reporter_id = OLD.id OR against_id = OLD.id;

  -- 1b. Messages de litige envoyés par cet utilisateur dans d'AUTRES litiges
  --     (litiges qui ne le concernent pas en tant que reporter/against mais
  --      où il est intervenu en tant qu'admin ou tiers).
  --     sender_id est NOT NULL → suppression obligatoire.
  DELETE FROM dispute_messages
  WHERE sender_id = OLD.id;

  -- 1c. Boutique du marchand (produits, commandes shop, dettes → cascade)
  DELETE FROM shops WHERE merchant_id = OLD.id;

  -- La cascade profiles_id_fkey (auth.users → profiles) prend le relais
  -- pour supprimer le profil et tout ce qui en dépend (notifications,
  -- favoris, conversations, récompenses, classements).
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_delete ON auth.users;
CREATE TRIGGER on_auth_user_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_before_delete();

-- ── 2. Nettoyage des profils orphelins ────────────────────────────────────────
--    Profils dont l'entrée auth.users a disparu (suppression directe via
--    dashboard Supabase ou Edge Function incomplète).

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- D'abord nettoyer les disputes orphelines pour éviter les FK violations
  -- (dispute_messages cascade automatiquement via ON DELETE CASCADE sur dispute_id)
  DELETE FROM disputes d
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.reporter_id)
     OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.against_id);

  -- Messages de litige dont l'expéditeur n'existe plus dans auth.users
  DELETE FROM dispute_messages dm
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = dm.sender_id);

  -- Ensuite supprimer les profils orphelins
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profils orphelins supprimés : %', v_count;
END$$;

-- ── 3. Backfill des profils manquants ────────────────────────────────────────
--    Crée un profil pour chaque auth.users récent sans profil.
--    Les données viennent de raw_user_meta_data (posé lors du signUp).

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, name, phone, auth_email, email, role)
  SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),  'Utilisateur'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''), ''),
    u.email,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'real_email', '')), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'role'), ''),  'client')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profils manquants créés : %', v_count;
END$$;

-- ── 4. Vérification finale ────────────────────────────────────────────────────

DO $$
DECLARE
  v_orphan_profiles   INTEGER;
  v_missing_profiles  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphan_profiles
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

  SELECT COUNT(*) INTO v_missing_profiles
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

  RAISE NOTICE '=== Résultat sync ===';
  RAISE NOTICE 'Profils orphelins restants : %', v_orphan_profiles;
  RAISE NOTICE 'auth.users sans profil     : %', v_missing_profiles;
END$$;
