-- Migration : filtrer product_count sur produits actifs uniquement (stock = 'in')
-- Bug corrigé : update_shop_product_count comptait TOUS les produits (y compris stock='out')
-- résultat : un prestataire avec 2 produits hors-stock apparaissait quand même dans le feed.
-- Fix : recompter uniquement WHERE stock = 'in', et mettre à jour le trigger.

-- 1. Recorriger la fonction trigger pour ne compter que les produits en stock
CREATE OR REPLACE FUNCTION public.update_shop_product_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- n'incrémente que si le nouveau produit est en stock
    IF NEW.stock = 'in' THEN
      UPDATE shops SET product_count = product_count + 1 WHERE id = NEW.shop_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.stock = 'in' THEN
      UPDATE shops SET product_count = GREATEST(product_count - 1, 0) WHERE id = OLD.shop_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- changement de boutique
    IF OLD.shop_id IS DISTINCT FROM NEW.shop_id THEN
      IF OLD.stock = 'in' THEN
        UPDATE shops SET product_count = GREATEST(product_count - 1, 0) WHERE id = OLD.shop_id;
      END IF;
      IF NEW.stock = 'in' THEN
        UPDATE shops SET product_count = product_count + 1 WHERE id = NEW.shop_id;
      END IF;
    -- changement de stock dans la même boutique
    ELSIF OLD.stock IS DISTINCT FROM NEW.stock THEN
      IF NEW.stock = 'in' THEN
        -- produit remis en stock
        UPDATE shops SET product_count = product_count + 1 WHERE id = NEW.shop_id;
      ELSE
        -- produit sorti du stock
        UPDATE shops SET product_count = GREATEST(product_count - 1, 0) WHERE id = NEW.shop_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Recréer le trigger en ajoutant la colonne stock au filtre UPDATE
--    (sinon le trigger n'est pas appelé quand on change stock sans changer shop_id)
DROP TRIGGER IF EXISTS trg_product_count ON public.products;
CREATE TRIGGER trg_product_count
  AFTER INSERT OR DELETE OR UPDATE OF shop_id, stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_product_count();

-- 3. PAS de backfill — les shops existants ne sont pas touchés.
-- Le trigger corrigé s'applique uniquement aux nouveaux produits ajoutés à partir de maintenant.
