-- Jusqu'à 3 images par produit (carrousel vitrine web + app client).
-- photo_url reste la source principale/legacy ; images[0] la double pour compat.
-- Règle d'affichage : images si non vide, sinon [photo_url].
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT NULL;
