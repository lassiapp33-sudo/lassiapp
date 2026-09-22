-- Suppression définitive de la boutique demo "Shop" (Musculation / Fitness)
-- À exécuter dans Supabase Dashboard → SQL Editor

DO $$
DECLARE
  v_user_id  UUID;
  v_shop_id  UUID;
  v_order_ids UUID[];
BEGIN

  -- 1. Trouver la boutique par nom exact
  SELECT id, merchant_id INTO v_shop_id, v_user_id
  FROM shops
  WHERE name = 'Shop'
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE NOTICE 'Boutique "Shop" introuvable';
    RETURN;
  END IF;

  RAISE NOTICE 'shop_id = %, user_id = %', v_shop_id, v_user_id;

  -- 2. IDs des commandes de cette boutique
  SELECT ARRAY(SELECT id FROM orders WHERE shop_id = v_shop_id)
  INTO v_order_ids;

  -- 3. Supprimer payment_intents (FK bloquante)
  IF array_length(v_order_ids, 1) > 0 THEN
    DELETE FROM payment_intents WHERE order_id = ANY(v_order_ids);
    DELETE FROM order_ratings    WHERE order_id = ANY(v_order_ids);
    RAISE NOTICE 'payment_intents + order_ratings supprimés';
  END IF;

  -- 4. Supprimer abonnements et réservations
  DELETE FROM abonnements          WHERE shop_id = v_shop_id;
  DELETE FROM reservations_terrain WHERE shop_id = v_shop_id;

  -- 5. Supprimer la boutique (CASCADE → orders, products, dettes, conversations…)
  DELETE FROM shops WHERE id = v_shop_id;
  RAISE NOTICE 'boutique supprimée';

  -- 6. Supprimer le profil (CASCADE → notifications, favorites, classements…)
  DELETE FROM profiles WHERE id = v_user_id;
  RAISE NOTICE 'profil supprimé';

  -- 7. Supprimer auth.users → libère email + téléphone
  DELETE FROM auth.users WHERE id = v_user_id;
  RAISE NOTICE 'compte auth supprimé — suppression complète OK';

END $$;
