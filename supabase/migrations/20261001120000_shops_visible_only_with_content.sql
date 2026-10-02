-- Masquer les boutiques sans contenu : s'assurer que has_content est correctement
-- initialisé à false pour toute nouvelle boutique (déjà DEFAULT false, confirmation).
-- Backfill de sécurité pour les shops dont le flag serait NULL ou incohérent.

-- S'assurer que la colonne a bien le bon défaut
ALTER TABLE public.shops
  ALTER COLUMN has_content SET DEFAULT false;

-- Backfill : recalcule toutes les boutiques (idempotent, basé sur refresh_shop_has_content)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    PERFORM public.refresh_shop_has_content(r.id);
  END LOOP;
END;
$$;
