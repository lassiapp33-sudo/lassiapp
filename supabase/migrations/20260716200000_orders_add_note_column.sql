-- ===========================================================================
-- CORRECTION : colonne "note" manquante dans la table orders
-- ---------------------------------------------------------------------------
-- La fonction create_order_atomic insère la note client depuis le début,
-- mais la colonne n'avait jamais été ajoutée à la table orders.
-- Résultat : toute tentative de passer une commande échouait avec
--   error 42703 "column note of relation orders does not exist"
-- ===========================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS note TEXT;
