-- Colonne d'idempotence pour create-order.
-- Garantit qu'un double appel (double-clic, retry réseau) ne crée pas deux commandes.
-- La contrainte UNIQUE sur (client_id, idempotency_key) bloque les doublons par client.
-- Deux clients différents partageant la même clé ne se gênent pas.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Supprimer l'ancien index global (non scopé au client)
DROP INDEX IF EXISTS idx_orders_idempotency_key;

-- Nouvel index : unique par client + clé (scopé au client, pas global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
