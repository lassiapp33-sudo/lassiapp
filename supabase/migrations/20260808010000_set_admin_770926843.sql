-- Réinitialise is_admin sur tous les profils, puis active uniquement
-- le prestataire avec le téléphone 770926843.
UPDATE public.profiles SET is_admin = false WHERE is_admin = true;
UPDATE public.profiles SET is_admin = true  WHERE phone = '770926843';
