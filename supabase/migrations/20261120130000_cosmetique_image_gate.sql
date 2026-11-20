-- Appliquer le gate image (has_enough_images) aux boutiques COSMÉTIQUE.
-- Problème : les boutiques parfumerie/soins_bio ont shop_type='services' (sentinelle
-- héritée de la beauté), donc elles bypassaient le gate image et restaient visibles
-- même sans aucun produit photographié → fiche "Aucun produit disponible".
--
-- Nouvelle règle : la cosmétique VEND des produits → elle doit obéir au gate image
-- comme n'importe quel commerçant, peu importe son shop_type.
--   * category = 'hair' (beauté pure) → toujours visible (services sans photo normaux)
--   * shop_type = 'services' ET category <> 'cosmetique' → toujours visible
--   * sinon (dont cosmetique) : visible SI (0 produit) OU (ratio images >= 30%)
-- Réapparition AUTOMATIQUE dès qu'un produit avec photo est ajouté (trigger existant).

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

  -- Beauté pure + vrais services (hors cosmétique) : toujours visibles, pas d'exigence image
  IF v_category = 'hair'
     OR (v_type = 'services' AND v_category IS DISTINCT FROM 'cosmetique') THEN
    UPDATE shops SET has_enough_images = true WHERE id = p_shop;
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE photo_url LIKE 'http%')
  INTO v_total, v_with_img
  FROM products WHERE shop_id = p_shop;

  -- Aucun produit → ne pas masquer sur ce critère (gate product_count/has_content s'applique)
  v_gate := (v_total = 0) OR (v_with_img::numeric / v_total >= 0.30);

  UPDATE shops SET has_enough_images = v_gate WHERE id = p_shop;
END;
$$;

-- Backfill : recalculer toutes les boutiques cosmétique
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.shops WHERE category = 'cosmetique' LOOP
    PERFORM public.recompute_shop_image_gate(r.id);
  END LOOP;
END $$;
