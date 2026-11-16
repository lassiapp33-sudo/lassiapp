-- Masquer de l'APP CLIENT les boutiques (hors services/beauté) dont moins de 30%
-- des produits ont une vraie image. Elles restent accessibles via leur site web
-- (vitrine s.lassi.tech) et peuvent recevoir des commandes web.
-- Réapparition AUTOMATIQUE dès que le ratio d'images atteint 30%.
--
-- Règle :
--   * shop_type = 'services'  → jamais masqué (pas d'exigence image)
--   * category  = 'hair' (beauté) → jamais masqué
--   * sinon : visible SI (aucun produit) OU (nb_produits_avec_image / nb_produits >= 0.30)
--   * une image = photo_url commençant par 'http' (sinon c'est un emoji / vide)

-- 1. Colonne gate (défaut true = visible, ne casse rien tant que backfill pas fait)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS has_enough_images BOOLEAN NOT NULL DEFAULT true;

-- 2. Fonction de recalcul pour une boutique
CREATE OR REPLACE FUNCTION public.recompute_shop_image_gate(p_shop UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type     TEXT;
  v_category TEXT;
  v_total    INTEGER;
  v_with_img INTEGER;
  v_gate     BOOLEAN;
BEGIN
  IF p_shop IS NULL THEN RETURN; END IF;

  SELECT shop_type, category INTO v_type, v_category
  FROM shops WHERE id = p_shop;

  IF NOT FOUND THEN RETURN; END IF;

  -- Services et beauté : toujours visibles, pas d'exigence image
  IF v_type = 'services' OR v_category = 'hair' THEN
    UPDATE shops SET has_enough_images = true WHERE id = p_shop;
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE photo_url LIKE 'http%')
  INTO v_total, v_with_img
  FROM products WHERE shop_id = p_shop;

  -- Aucun produit → ne pas masquer sur ce critère (autres filtres s'appliquent)
  v_gate := (v_total = 0) OR (v_with_img::numeric / v_total >= 0.30);

  UPDATE shops SET has_enough_images = v_gate WHERE id = p_shop;
END;
$$;

-- 3. Trigger produit : recalcule à chaque changement d'image / ajout / suppression
CREATE OR REPLACE FUNCTION public.trg_products_image_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_shop_image_gate(NEW.shop_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_shop_image_gate(OLD.shop_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_shop_image_gate(NEW.shop_id);
    IF OLD.shop_id IS DISTINCT FROM NEW.shop_id THEN
      PERFORM public.recompute_shop_image_gate(OLD.shop_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_image_gate ON public.products;
CREATE TRIGGER trg_products_image_gate
  AFTER INSERT OR DELETE OR UPDATE OF photo_url, shop_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_products_image_gate();

-- 4. Si une boutique change de type/catégorie, recalculer aussi
CREATE OR REPLACE FUNCTION public.trg_shops_image_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_shop_image_gate(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_shops_image_gate ON public.shops;
CREATE TRIGGER trg_shops_image_gate
  AFTER UPDATE OF shop_type, category ON public.shops
  FOR EACH ROW
  WHEN (OLD.shop_type IS DISTINCT FROM NEW.shop_type
     OR OLD.category  IS DISTINCT FROM NEW.category)
  EXECUTE FUNCTION public.trg_shops_image_gate();

-- 5. Backfill de toutes les boutiques
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    PERFORM public.recompute_shop_image_gate(r.id);
  END LOOP;
END $$;
