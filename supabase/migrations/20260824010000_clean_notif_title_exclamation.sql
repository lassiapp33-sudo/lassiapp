-- ===========================================================================
-- LASSI — Supprime les "!" résiduels dans les titres de notifications
-- ---------------------------------------------------------------------------
-- Cause : ancienne version du code générait "Nouvelle commande !" — les
--         titres actuels n'ont plus de "!" mais des données historiques
--         peuvent encore en contenir.
-- ===========================================================================

UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '\s*!\s*$', ''))
WHERE title LIKE '%!';

-- Confirmation dans les logs
DO $$ BEGIN
  RAISE NOTICE '[lassi] notifications nettoyées (titre sans !) : % lignes',
    (SELECT COUNT(*) FROM public.notifications WHERE title NOT LIKE '%!');
END $$;
