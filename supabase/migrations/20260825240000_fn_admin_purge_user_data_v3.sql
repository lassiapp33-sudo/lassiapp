-- v3 : SET LOCAL row_security = off pour bypasser RLS dans tous les SELECTs/DELETEs
-- Sans ça, SELECT sur payment_intents retourne moins de lignes qu'il y en a réellement
-- → certains payment_logs restent → FK "gave unexpected result" sur CASCADE.

CREATE OR REPLACE FUNCTION public.admin_purge_user_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_intent_ids UUID[];
  v_shop_id            UUID;
  v_order_ids          UUID[];
  v_dispute_ids        UUID[];
BEGIN
  -- Désactiver RLS pour toute la transaction (nécessaire pour voir toutes les lignes)
  SET LOCAL row_security = off;

  -- 1. payment_intents → toutes les tables qui les référencent (pas de CASCADE)
  SELECT ARRAY_AGG(id) INTO v_payment_intent_ids
  FROM payment_intents
  WHERE client_id = p_user_id OR prestataire_id = p_user_id;

  IF v_payment_intent_ids IS NOT NULL THEN
    DELETE FROM payment_logs        WHERE payment_intent_id = ANY(v_payment_intent_ids);
    DELETE FROM payout_queue        WHERE payment_intent_id = ANY(v_payment_intent_ids);
    DELETE FROM livraison_paiements WHERE payment_intent_id = ANY(v_payment_intent_ids);
    DELETE FROM payment_intents     WHERE id               = ANY(v_payment_intent_ids);
  END IF;

  -- 2. payout_queue restants par prestataire_id
  DELETE FROM payout_queue WHERE prestataire_id = p_user_id;

  -- 3. payments.prestataire_id → auth.users(id) sans CASCADE : NULL-out
  UPDATE payments SET prestataire_id = NULL WHERE prestataire_id = p_user_id;

  -- 4. Favoris
  DELETE FROM favorites WHERE user_id = p_user_id;

  -- 5. Commandes client
  SELECT ARRAY_AGG(id) INTO v_order_ids FROM orders WHERE client_id = p_user_id;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM order_items WHERE order_id = ANY(v_order_ids);
    DELETE FROM orders      WHERE id       = ANY(v_order_ids);
  END IF;

  -- 6. Boutique marchand
  SELECT id INTO v_shop_id FROM shops WHERE merchant_id = p_user_id LIMIT 1;
  IF v_shop_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_order_ids FROM orders WHERE shop_id = v_shop_id;
    IF v_order_ids IS NOT NULL THEN
      DELETE FROM order_items WHERE order_id = ANY(v_order_ids);
      DELETE FROM orders      WHERE id       = ANY(v_order_ids);
    END IF;
    DELETE FROM debts    WHERE shop_id = v_shop_id;
    DELETE FROM products WHERE shop_id = v_shop_id;
    DELETE FROM shops    WHERE id      = v_shop_id;
  END IF;

  -- 7. Litiges (reporter_id / against_id sont NOT NULL)
  SELECT ARRAY_AGG(id) INTO v_dispute_ids
  FROM disputes
  WHERE reporter_id = p_user_id OR against_id = p_user_id;
  IF v_dispute_ids IS NOT NULL THEN
    DELETE FROM dispute_messages WHERE dispute_id = ANY(v_dispute_ids);
    DELETE FROM disputes         WHERE id         = ANY(v_dispute_ids);
  END IF;
  DELETE FROM dispute_messages WHERE sender_id = p_user_id;

  -- 8. Réservations de table
  DELETE FROM table_reservations WHERE client_id = p_user_id;

  -- 9. Profil
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_user_data(UUID) FROM PUBLIC, anon, authenticated;
