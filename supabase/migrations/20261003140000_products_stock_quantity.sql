-- Quantité en stock pour habillement (et toute autre sous-catégorie qui veut gérer un stock numérique)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT NULL;
