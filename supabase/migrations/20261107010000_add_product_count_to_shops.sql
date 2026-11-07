-- Migration : ajouter product_count sur shops + trigger de maintenance automatique
-- Objectif : filtrer shops avec 2+ produits dans l'app mobile sans COUNT(*) à chaque requête

-- 1. Colonne
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS product_count INTEGER NOT NULL DEFAULT 0;

-- 2. Initialiser les valeurs existantes
UPDATE public.shops s
SET product_count = (
  SELECT COUNT(*) FROM public.products p WHERE p.shop_id = s.id
);

-- 3. Fonction trigger
CREATE OR REPLACE FUNCTION public.update_shop_product_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE shops SET product_count = product_count + 1 WHERE id = NEW.shop_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE shops SET product_count = GREATEST(product_count - 1, 0) WHERE id = OLD.shop_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.shop_id IS DISTINCT FROM NEW.shop_id THEN
    UPDATE shops SET product_count = GREATEST(product_count - 1, 0) WHERE id = OLD.shop_id;
    UPDATE shops SET product_count = product_count + 1 WHERE id = NEW.shop_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_product_count ON public.products;
CREATE TRIGGER trg_product_count
  AFTER INSERT OR DELETE OR UPDATE OF shop_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_product_count();
