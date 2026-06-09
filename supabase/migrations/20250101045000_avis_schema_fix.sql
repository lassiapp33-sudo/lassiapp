-- ===========================================================================
-- LASSI — Fix schéma avis sur DB existante
-- avis.sql utilise CREATE TABLE IF NOT EXISTS qui ne modifie jamais une table
-- déjà existante. Ce script applique les changements structurels idempotents.
-- SAFE à re-exécuter.
-- ===========================================================================

-- ① Rendre order_id nullable (était NOT NULL dans l'ancienne version)
--    Sans effet si déjà nullable.
ALTER TABLE avis ALTER COLUMN order_id DROP NOT NULL;

-- ② Changer le comportement ON DELETE : CASCADE → SET NULL
--    On drop l'ancienne FK et on recrée avec SET NULL.
ALTER TABLE avis DROP CONSTRAINT IF EXISTS avis_order_id_fkey;
ALTER TABLE avis
  ADD CONSTRAINT avis_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ③ Supprimer l'ancienne contrainte UNIQUE (order_id)
ALTER TABLE avis DROP CONSTRAINT IF EXISTS avis_order_id_key;

-- ④ Créer la nouvelle contrainte UNIQUE (shop_id, author_id) si absente
CREATE UNIQUE INDEX IF NOT EXISTS avis_shop_id_author_id_key
  ON avis (shop_id, author_id);

-- ⑤ Supprimer l'ancien index sur order_id (inutile sans la contrainte)
DROP INDEX IF EXISTS idx_avis_order_id;

-- ===========================================================================
-- ROLLBACK
-- DROP INDEX IF EXISTS avis_shop_id_author_id_key;
-- ALTER TABLE avis DROP CONSTRAINT IF EXISTS avis_order_id_fkey;
-- ALTER TABLE avis ADD CONSTRAINT avis_order_id_fkey
--   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
-- ALTER TABLE avis ALTER COLUMN order_id SET NOT NULL;
-- ===========================================================================
