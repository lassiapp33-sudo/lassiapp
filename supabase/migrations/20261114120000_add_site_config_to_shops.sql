-- ─────────────────────────────────────────────────────────────────────────────
-- Site Builder prestataire — "Personnaliser mon site web"
-- Colonne JSONB qui pilote UNIQUEMENT la présentation de la vitrine
-- s.lassi.tech/<slug> (template, couleurs, polices, layout, nom affiché).
--
-- INVARIANTS :
--   • NULL (défaut) => rendu actuel EXACT. Tout le parc existant reste inchangé.
--   • Ne contient JAMAIS de donnée métier (produits/prix/horaires). Pure présentation.
--   • displayName éventuel = nom affiché sur le site seulement, n'écrase pas shops.name.
--   • Lecture publique (anon) nécessaire : l'edge Vercel lit avec la clé anon.
--   • Écriture réservée au propriétaire (merchant_id = auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS site_config JSONB;

COMMENT ON COLUMN public.shops.site_config IS
  'Site Builder : présentation vitrine web (template/tokens/layout/displayName). NULL = rendu par défaut. Jamais de donnée métier.';

-- Garde-fou : une config non nulle doit être un objet JSON (pas un scalaire/array).
ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_site_config_is_object;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_site_config_is_object
  CHECK (site_config IS NULL OR jsonb_typeof(site_config) = 'object');
