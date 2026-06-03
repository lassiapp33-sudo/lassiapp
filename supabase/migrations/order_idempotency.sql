-- Colonne d'idempotence pour create-order.
-- Garantit qu'un double appel (double-clic, retry réseau) ne crée pas deux commandes.
-- La contrainte UNIQUE sur (idempotency_key) bloque silencieusement les doublons
-- côté DB — le check applicatif dans l'Edge Function retourne la commande existante.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
