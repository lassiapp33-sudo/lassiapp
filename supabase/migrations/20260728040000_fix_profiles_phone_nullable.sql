-- Fix : profiles.phone doit être nullable pour permettre l'anonymisation
-- lors de la suppression de compte (deleteAccount EF).
-- Le CHECK profiles_phone_format_check autorise déjà NULL (phone IS NULL OR ...),
-- mais la colonne elle-même avait une contrainte NOT NULL implicite.

ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
