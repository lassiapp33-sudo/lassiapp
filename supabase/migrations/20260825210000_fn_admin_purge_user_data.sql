-- ===========================================================================
-- Fonction SECURITY DEFINER pour purger toutes les données d'un utilisateur
-- avant de supprimer son profil et son compte auth.
-- ---------------------------------------------------------------------------
-- Appelée par l'Edge Function admin-delete-user via RPC.
-- SECURITY DEFINER contourne les RLS et les checks RI qui échouaient avec
-- le client service_role JS ("gave unexpected result" sur payment_logs).
-- ===========================================================================

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

  -- 2. payout_queue restants par prestataire_id (si PI déjà supprimé ailleurs)
  DELETE FROM payout_queue WHERE prestataire_id = p_user_id;

  -- 2b. payments.prestataire_id → auth.users(id) sans CASCADE : NULL-out
  UPDATE payments SET prestataire_id = NULL WHERE prestataire_id = p_user_id;

  -- 3. Favoris
  DELETE FROM favorites WHERE user_id = p_user_id;

  -- 4. Commandes client
  SELECT ARRAY_AGG(id) INTO v_order_ids FROM orders WHERE client_id = p_user_id;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM order_items WHERE order_id = ANY(v_order_ids);
    DELETE FROM orders      WHERE id       = ANY(v_order_ids);
  END IF;

  -- 5. Boutique marchand
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

  -- 6. Litiges (reporter_id / against_id sont NOT NULL → suppression obligatoire)
  SELECT ARRAY_AGG(id) INTO v_dispute_ids
  FROM disputes
  WHERE reporter_id = p_user_id OR against_id = p_user_id;
  IF v_dispute_ids IS NOT NULL THEN
    DELETE FROM dispute_messages WHERE dispute_id = ANY(v_dispute_ids);
    DELETE FROM disputes         WHERE id         = ANY(v_dispute_ids);
  END IF;
  DELETE FROM dispute_messages WHERE sender_id = p_user_id;

  -- 7. Réservations de table
  DELETE FROM table_reservations WHERE client_id = p_user_id;

  -- 8. Profil (déclenche cascades restantes gérées par la DB)
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_user_data(UUID) FROM PUBLIC, anon, authenticated;
