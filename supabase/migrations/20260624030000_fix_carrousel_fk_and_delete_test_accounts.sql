-- ===========================================================================
-- LASSİ — Fix FK carrousel + suppression des comptes test Ba/Touiu
-- ---------------------------------------------------------------------------
-- 1. carrousel_offre_quartier.product_id n'avait pas de règle ON DELETE
--    → PostgreSQL refusait de supprimer les produits d'un marchand supprimé.
-- 2. Suppression propre des comptes test Balla (boutique "Ba") et
--    Balaaa (boutique "Touiu") avec toutes leurs données liées.
-- ===========================================================================

-- ── 1. Fix FK carrousel_offre_quartier.product_id ────────────────────────────

ALTER TABLE carrousel_offre_quartier
  DROP CONSTRAINT IF EXISTS carrousel_offre_quartier_product_id_fkey;

ALTER TABLE carrousel_offre_quartier
  ADD CONSTRAINT carrousel_offre_quartier_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


-- ── 2. Vérification ──────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'FK carrousel_offre_quartier.product_id corrigé → ON DELETE CASCADE';
  RAISE NOTICE 'La suppression des comptes Ba/Touiu est maintenant possible depuis le dashboard admin.';
END $$;
