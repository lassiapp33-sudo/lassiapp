-- Ajout vocal_url sur la table avis (avis audio clients depuis AvisForm)
ALTER TABLE avis ADD COLUMN IF NOT EXISTS vocal_url TEXT;

NOTIFY pgrst, 'reload schema';
