-- Ajoute la colonne metadata manquante dans payment_intents
-- Nécessaire pour les paiements d'abonnements fitness (create-fitness-abonnement-payment)
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS metadata JSONB;
