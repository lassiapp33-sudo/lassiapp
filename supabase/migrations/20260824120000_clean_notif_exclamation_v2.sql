-- ===========================================================================
-- LASSI — Nettoyage agressif des "!" dans les titres de notifications (v2)
-- Couvre : "Nouvelle commande !", "Commande !", etc. — y compris espaces
--          insécables et variantes Unicode avant "!".
-- ===========================================================================

UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '[[:space:]]*![[:space:]]*$', ''))
WHERE title ~ '!';

-- Correctif ciblé pour "Nouvelle commande" en cas de variante résiduelle
UPDATE public.notifications
SET title = 'Nouvelle commande'
WHERE title ILIKE '%nouvelle commande%'
  AND title <> 'Nouvelle commande';
