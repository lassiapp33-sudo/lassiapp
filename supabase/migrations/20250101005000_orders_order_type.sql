-- ─── Ajout order_type à la table orders ──────────────────────────────────────
-- Permet au prestataire de voir si la commande est "sur place" ou "à emporter".

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'place'
  CHECK (order_type IN ('place', 'emporter'));

COMMENT ON COLUMN orders.order_type IS 'place = sur place, emporter = à emporter';
