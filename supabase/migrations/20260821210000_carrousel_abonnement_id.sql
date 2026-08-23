-- Ajout de abonnement_id dans carrousel_offre_quartier pour les offres fitness
-- Les entrées fitness ont : product_id=NULL, terrain_id=NULL, abonnement_id=<uuid>
ALTER TABLE public.carrousel_offre_quartier
  ADD COLUMN IF NOT EXISTS abonnement_id UUID REFERENCES fitness_abonnement_offres(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS carrousel_offre_quartier_abonnement_id_idx
  ON public.carrousel_offre_quartier (abonnement_id)
  WHERE abonnement_id IS NOT NULL;
