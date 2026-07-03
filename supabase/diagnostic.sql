-- Diagnostic LASSİ — état sync profiles / auth.users

-- 1. Combien de auth.users SANS profil ?
SELECT 'auth_users_sans_profil' AS check_name, COUNT(*) AS count
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 2. Combien de profils orphelins (profil sans auth.users) ?
SELECT 'profils_orphelins' AS check_name, COUNT(*) AS count
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- 3. Les auth.users sans profil (noms/emails pour identifier Touiu, Ba, etc.)
SELECT u.id, u.email, u.raw_user_meta_data->>'name' AS name,
       u.raw_user_meta_data->>'phone' AS phone,
       u.created_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ORDER BY u.created_at DESC
LIMIT 20;

-- 4. Les triggers sur auth.users
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- 5. La table profiles est-elle dans supabase_realtime ?
SELECT tablename, pubname FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'profiles';

-- 6. Les profiles avec name='Compte supprimé' (anonymisés)
SELECT COUNT(*) AS comptes_supprimes
FROM public.profiles WHERE name = 'Compte supprimé';

-- 7. Total profils
SELECT COUNT(*) AS total_profils FROM public.profiles;

-- 8. Total auth.users
SELECT COUNT(*) AS total_auth_users FROM auth.users;

-- 9. Derniers profils créés
SELECT id, name, phone, role, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- 10. Contrainte phone sur profiles
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
