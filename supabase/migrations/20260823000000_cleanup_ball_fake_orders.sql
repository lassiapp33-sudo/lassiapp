-- Supprime les 6 commandes fictives insérées dans la boutique Ball
-- par seed_demo_apple_encaissements_historique.sql (PARTIE B)
-- Seul Testapple (781666999) était concerné comme client dans ces fausses commandes.
-- Les données fictives de la boutique Testapple elle-même sont intactes.

DO $$
DECLARE
  v_merchant_id uuid;
  v_shop_id     uuid;
  v_deleted_items integer;
  v_deleted_orders integer;
BEGIN
  SELECT id INTO v_merchant_id
  FROM profiles
  WHERE phone ILIKE '%781666999%'
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RAISE NOTICE '⚠ Compte Testapple introuvable — rien à nettoyer';
    RETURN;
  END IF;

  SELECT id INTO v_shop_id
  FROM shops
  WHERE merchant_id = v_merchant_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Supprimer order_items d'abord (FK)
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT id FROM orders
    WHERE client_id = v_merchant_id
      AND shop_id <> v_shop_id
  );
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- Puis les commandes elles-mêmes
  DELETE FROM orders
  WHERE client_id = v_merchant_id
    AND shop_id <> v_shop_id;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

  RAISE NOTICE '✅ Nettoyage terminé';
  RAISE NOTICE '   order_items supprimés : %', v_deleted_items;
  RAISE NOTICE '   orders supprimés      : %', v_deleted_orders;
  RAISE NOTICE '   Boutique Ball revenue à sa vraie recette';
END $$;
