-- Nettoyage des titres de notifications : supprime les emojis de validation et "!"
-- Concerne les enregistrements insérés par d'anciennes versions des Edge Functions

UPDATE public.notifications
SET title = 'Reversement reçu'
WHERE title LIKE '%Reversement reçu%'
  AND title <> 'Reversement reçu';

UPDATE public.notifications
SET title = 'Nouvel abonné payé'
WHERE title LIKE '%Nouvel abonné payé%'
  AND title <> 'Nouvel abonné payé';

UPDATE public.notifications
SET title = 'Nouvelle commande'
WHERE title LIKE 'Nouvelle commande%'
  AND title <> 'Nouvelle commande';
