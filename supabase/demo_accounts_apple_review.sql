-- ============================================================
-- LASSI — Comptes démo Apple Review
-- Idempotent : safe à re-exécuter plusieurs fois
--
-- Client   : téléphone 785541265  | mot de passe Demo2024!
-- Marchand : téléphone 779966333  | mot de passe Demo2024!
-- ============================================================

BEGIN;

-- ─── 1. CLEANUP (ordre : produits → vitrine → auth → profiles en cascade) ────

DELETE FROM public.products
WHERE shop_id = 'cccccccc-0003-0003-0003-000000000003';

DELETE FROM public.shops
WHERE id = 'cccccccc-0003-0003-0003-000000000003';

DELETE FROM auth.users
WHERE id IN (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'bbbbbbbb-0002-0002-0002-000000000002'
);

-- ─── 2. COMPTES AUTH ─────────────────────────────────────────────────────────

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  is_sso_user
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'authenticated', 'authenticated',
    '221785541265@lassi.app',
    crypt('Demo2024!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Client Démo","phone":"785541265","role":"client","real_email":"client.demo.apple@lassi.tech"}'::jsonb,
    false, now(), now(), '', '', false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'authenticated', 'authenticated',
    '221779966333@lassi.app',
    crypt('Demo2024!', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tangana Démo","phone":"779966333","role":"merchant","real_email":"merchant.demo.apple@lassi.tech"}'::jsonb,
    false, now(), now(), '', '', false
  );

-- ─── 2b. IDENTITIES (obligatoire pour GoTrue v2) ─────────────────────────────

DELETE FROM auth.identities WHERE user_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'bbbbbbbb-0002-0002-0002-000000000002'
);

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (
    '221785541265@lassi.app',
    'aaaaaaaa-0001-0001-0001-000000000001',
    '{"sub":"aaaaaaaa-0001-0001-0001-000000000001","email":"221785541265@lassi.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '221779966333@lassi.app',
    'bbbbbbbb-0002-0002-0002-000000000002',
    '{"sub":"bbbbbbbb-0002-0002-0002-000000000002","email":"221779966333@lassi.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now(), now()
  );

-- ─── 3. PROFILES (trigger a créé les lignes → on complète) ──────────────────

UPDATE public.profiles SET
  name       = 'Client Démo',
  phone      = '785541265',
  email      = 'client.demo.apple@lassi.tech',
  auth_email = '221785541265@lassi.app',
  role       = 'client'
WHERE id = 'aaaaaaaa-0001-0001-0001-000000000001';

UPDATE public.profiles SET
  name       = 'Tangana Démo',
  phone      = '779966333',
  email      = 'merchant.demo.apple@lassi.tech',
  auth_email = '221779966333@lassi.app',
  role       = 'merchant'
WHERE id = 'bbbbbbbb-0002-0002-0002-000000000002';

-- ─── 4. VITRINE TANGANA ──────────────────────────────────────────────────────

INSERT INTO public.shops (
  id,
  merchant_id,
  name,
  subtitle,
  category,
  subcategories,
  shop_type,
  zone,
  address_text,
  description,
  is_open,
  latitude,
  longitude,
  opening_hours,
  is_manually_closed,
  gallery_urls,
  rating,
  reviews_count
) VALUES (
  'cccccccc-0003-0003-0003-000000000003',
  'bbbbbbbb-0002-0002-0002-000000000002',
  'Tangana Démo Apple',
  'Café Touba • Thiébou • Snacks',
  'tangana',
  '["tangana","ndeki"]'::jsonb,
  'products',
  'Médina',
  'Rue 10, Médina, Dakar',
  'Votre tangana de quartier — café Touba, petits-déjeuners et plats du jour.',
  true,
  14.6937,
  -17.4441,
  '{"lundi":{"open":"07:00","close":"22:00","closed":false},"mardi":{"open":"07:00","close":"22:00","closed":false},"mercredi":{"open":"07:00","close":"22:00","closed":false},"jeudi":{"open":"07:00","close":"22:00","closed":false},"vendredi":{"open":"07:00","close":"22:00","closed":false},"samedi":{"open":"07:00","close":"23:00","closed":false},"dimanche":{"open":"08:00","close":"21:00","closed":false}}'::jsonb,
  false,
  '[]'::jsonb,
  4.8,
  47
);

-- ─── 5. PRODUITS ─────────────────────────────────────────────────────────────

INSERT INTO public.products (id, shop_id, name, price, description, stock, item_type) VALUES
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Café Touba',        200,  'Café Touba traditionnel chaud',            'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Thé à la menthe',   200,  'Thé vert à la menthe fraîche',             'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Pain beurre',       300,  'Baguette fraîche beurre-sucre',            'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Omelette baguette', 700,  'Omelette aux légumes en baguette',         'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Thiéboudienne',     1500, 'Riz au poisson sauce tomate avec légumes', 'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Jus de Bissap',     350,  'Jus d''hibiscus frais maison',             'in', 'product'),
  (gen_random_uuid(), 'cccccccc-0003-0003-0003-000000000003', 'Beignets (x4)',     500,  'Beignets chauds à la farine maison',       'in', 'product');

COMMIT;

-- ─── 6. VÉRIFICATION ─────────────────────────────────────────────────────────

SELECT 'auth.users'      AS tbl, id::text, email                      FROM auth.users   WHERE id IN ('aaaaaaaa-0001-0001-0001-000000000001','bbbbbbbb-0002-0002-0002-000000000002')
UNION ALL
SELECT 'profiles'        AS tbl, id::text, name || ' | ' || role      FROM public.profiles WHERE id IN ('aaaaaaaa-0001-0001-0001-000000000001','bbbbbbbb-0002-0002-0002-000000000002')
UNION ALL
SELECT 'shops'           AS tbl, id::text, name                        FROM public.shops   WHERE id = 'cccccccc-0003-0003-0003-000000000003'
UNION ALL
SELECT 'products (' || count(*)::text || ')' AS tbl, shop_id::text, string_agg(name, ', ' ORDER BY price) FROM public.products WHERE shop_id = 'cccccccc-0003-0003-0003-000000000003' GROUP BY shop_id;
