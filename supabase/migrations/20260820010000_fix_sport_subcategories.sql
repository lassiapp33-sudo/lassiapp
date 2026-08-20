-- ============================================================
-- Fix : shops Sport avec subcategories[] vide
-- Les prestataires Sport inscrits sans sous-catégorie n'apparaissent
-- dans aucun onglet de la page Catégorie.
-- On infère la sous-catégorie depuis le subtitle, défaut = musculation.
-- ============================================================

UPDATE public.shops
SET subcategories = CASE
  WHEN subtitle ILIKE '%Musculation%' OR subtitle ILIKE '%Fitness%'
    THEN '["musculation"]'::jsonb
  WHEN subtitle ILIKE '%terrain foot%' OR subtitle ILIKE '%football%'
    THEN '["reservation_terrain_foot"]'::jsonb
  WHEN subtitle ILIKE '%terrain basket%' OR subtitle ILIKE '%basketball%'
    THEN '["reservation_terrain_basket"]'::jsonb
  WHEN subtitle ILIKE '%arts martiaux%' OR subtitle ILIKE '%boxe%'
       OR subtitle ILIKE '%judo%'  OR subtitle ILIKE '%taekwondo%'
    THEN '["arts_martiaux"]'::jsonb
  ELSE '["musculation"]'::jsonb
END
WHERE category = 'sport'
  AND jsonb_array_length(COALESCE(subcategories, '[]'::jsonb)) = 0;
