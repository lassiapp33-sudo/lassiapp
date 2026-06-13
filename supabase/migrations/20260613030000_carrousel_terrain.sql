-- ============================================================
-- Carrousel "Offre di Quartier" — éligibilité des terrains
-- ============================================================
-- Les prestataires "réservation de terrain" (foot/basket) peuvent
-- mettre en avant un de leurs terrains dans le carrousel, en plus de
-- leurs produits. image_url contient alors un emoji (⚽/🏀) au lieu
-- d'une URL de photo.

ALTER TABLE carrousel_offre_quartier
  ADD COLUMN IF NOT EXISTS terrain_id UUID REFERENCES terrains(id) ON DELETE CASCADE;
