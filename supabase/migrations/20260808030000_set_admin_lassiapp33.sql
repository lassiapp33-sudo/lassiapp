-- Réinitialise is_admin sur tous les profils, puis active uniquement
-- le compte lassiapp33@gmail.com (compte admin officiel LASSI).
UPDATE public.profiles SET is_admin = false WHERE is_admin = true;

UPDATE public.profiles
SET    is_admin = true
WHERE  auth_email = 'lassiapp33@gmail.com'
   OR  email      = 'lassiapp33@gmail.com';
