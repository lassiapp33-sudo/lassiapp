-- Ajouter le statut 'failed' à visibility_subscriptions
-- Nécessaire pour que le webhook Orange Money puisse marquer un paiement échoué

ALTER TABLE visibility_subscriptions
  DROP CONSTRAINT IF EXISTS visibility_subscriptions_status_check;

ALTER TABLE visibility_subscriptions
  ADD CONSTRAINT visibility_subscriptions_status_check
  CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed'));
