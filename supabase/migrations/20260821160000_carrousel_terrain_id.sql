-- terrain_id dans carrousel_offre_quartier (migration manquante côté supabase root)
ALTER TABLE carrousel_offre_quartier
  ADD COLUMN IF NOT EXISTS terrain_id UUID REFERENCES terrains(id) ON DELETE CASCADE;
