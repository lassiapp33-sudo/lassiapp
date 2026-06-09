-- ===========================================================================
-- LASSI — Persistance du refus de commande
-- Ajoute refusal_reason + refused_at sur la table orders
-- SAFE à re-exécuter
-- ===========================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
  ADD COLUMN IF NOT EXISTS refused_at     TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
