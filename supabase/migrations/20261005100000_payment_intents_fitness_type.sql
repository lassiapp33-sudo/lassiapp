-- Ajoute 'fitness_abonnement' au CHECK constraint payment_intents_type_check
-- NOT VALID : ne revalide pas les lignes existantes (évite tout blocage)
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_type_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_type_check
  CHECK (type IN ('commande', 'table_reservation', 'livraison', 'fitness_abonnement')) NOT VALID;
