-- Correction : cible_id était uuid mais les IDs de catégories sont des strings (ex: 'petitdej')
-- Le changer en text permet de stocker les deux (UUID produits et labels catégories).

alter table promotions
  alter column cible_id type text using cible_id::text;
