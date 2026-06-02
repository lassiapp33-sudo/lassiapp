-- Nettoie les anciens emoji par défaut '🛍' dans photo_url
-- (valeur DEFAULT de la migration initiale, remplacée par '' = pas d'image)
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor

UPDATE products
SET photo_url = ''
WHERE photo_url = '🛍';

-- Optionnel : vider aussi le champ emoji s'il contient '📦' (ancien fallback)
UPDATE products
SET emoji = ''
WHERE emoji = '📦';
