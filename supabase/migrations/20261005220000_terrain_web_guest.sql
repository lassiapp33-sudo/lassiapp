-- Terrain web guest : nom et téléphone du client invité
-- Utilisé quand client_id = commande-web@lassi.tech (réservation depuis s.lassi.tech)
ALTER TABLE public.reservations_terrain ADD COLUMN IF NOT EXISTS client_name  TEXT;
ALTER TABLE public.reservations_terrain ADD COLUMN IF NOT EXISTS client_phone TEXT;
