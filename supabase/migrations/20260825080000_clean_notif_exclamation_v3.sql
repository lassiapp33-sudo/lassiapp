-- Nettoyage définitif des "!" dans les titres de notifications (v3)
-- Couvre toutes les variantes : espace normal, insécable, fin de chaîne

UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '\s*!\s*$', '', 'g'))
WHERE title ~ '!';

-- Ciblage direct "Nouvelle commande" toutes variantes
UPDATE public.notifications
SET title = 'Nouvelle commande'
WHERE title ILIKE '%nouvelle%commande%'
  AND title <> 'Nouvelle commande';
