-- ===========================================================================
-- Idempotence des commandes — colonne + index scopé (client_id, idempotency_key)
-- Garantit qu'un double appel ne crée pas deux commandes.
-- SAFE à re-exécuter (IF NOT EXISTS / IF EXISTS partout).
-- ===========================================================================

-- ① Ajouter la colonne si elle n'existe pas encore
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- ② Supprimer l'éventuel ancien index global (peut ne pas exister)
DROP INDEX IF EXISTS idx_orders_idempotency_key;

-- ③ Créer l'index scopé par client — correspond exactement à la requête
--    .eq('idempotency_key', key).eq('client_id', uid) dans l'Edge Function
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_client
  ON orders (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ===========================================================================
-- ROLLBACK
-- DROP INDEX IF EXISTS idx_orders_idempotency_client;
-- ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;
-- ===========================================================================
