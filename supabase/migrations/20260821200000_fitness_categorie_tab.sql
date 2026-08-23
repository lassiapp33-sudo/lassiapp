-- Lier les offres d'abonnement à leur onglet (Abonnements, Coaching personnel, etc.)
-- Chaque onglet a ses propres offres indépendantes

-- 1. Colonne qui identifie l'onglet propriétaire de l'offre
ALTER TABLE fitness_abonnement_offres
  ADD COLUMN IF NOT EXISTS categorie_tab TEXT;

-- 2. ON DELETE CASCADE sur offre_id dans fitness_abonnements_clients
--    (si l'offre est supprimée, les records clients le sont aussi)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fitness_abonnements_clients_offre_id_fkey'
      AND table_name = 'fitness_abonnements_clients'
  ) THEN
    ALTER TABLE fitness_abonnements_clients
      DROP CONSTRAINT fitness_abonnements_clients_offre_id_fkey;
  END IF;
  ALTER TABLE fitness_abonnements_clients
    ADD CONSTRAINT fitness_abonnements_clients_offre_id_fkey
    FOREIGN KEY (offre_id)
    REFERENCES fitness_abonnement_offres(id)
    ON DELETE CASCADE;
END $$;

-- 3. RPC : vérifier s'il y a des abonnés actifs pour UN onglet spécifique
CREATE OR REPLACE FUNCTION has_active_abonnes_for_tab(p_categorie_tab TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fitness_abonnements_clients fac
    JOIN fitness_abonnement_offres fao ON fao.id = fac.offre_id
    WHERE fao.prestataire_id = auth.uid()
      AND fao.categorie_tab = p_categorie_tab
      AND fac.statut = 'actif'
      AND fac.date_expiration > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION has_active_abonnes_for_tab(TEXT) TO authenticated;

-- 4. RPC : supprimer toutes les offres d'un onglet
--    (cascade supprime aussi les abonnements clients liés)
CREATE OR REPLACE FUNCTION delete_offres_for_tab(p_categorie_tab TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM fitness_abonnement_offres
  WHERE prestataire_id = auth.uid()
    AND categorie_tab = p_categorie_tab;
$$;

GRANT EXECUTE ON FUNCTION delete_offres_for_tab(TEXT) TO authenticated;
