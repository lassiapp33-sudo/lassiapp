-- Modes de paiement acceptés par chaque boutique
-- Valeurs possibles : 'wave', 'om'
-- Défaut : les deux activés pour les shops existants
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT '{wave,om}';
