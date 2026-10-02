-- Colonnes tailles et couleurs pour la sous-catégorie habillement
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sizes  text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS colors text[] DEFAULT NULL;
