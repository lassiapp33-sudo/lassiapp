-- Abaisse le montant minimum de commande de 100 → 10 FCFA
-- pour permettre les tests avec de petits montants.

CREATE OR REPLACE FUNCTION public.initiate_order_payment(
  p_order_id       UUID,
  p_client_id      UUID,
  p_moyen_paiement TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order           RECORD;
  v_prestataire_id  UUID;
  v_items_total     INTEGER;
  v_prix_base       INTEGER;
  v_idempotency_key TEXT;
  v_pi_id           UUID;
  v_blocking_id     UUID;
BEGIN
  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_method');
  END IF;

  SELECT id, client_id, shop_id, status, total, discount_amount
    INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.client_id <> p_client_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_order.status <> 'new' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  END IF;

  SELECT COALESCE(SUM(qty * unit_price), 0) INTO v_items_total
    FROM order_items WHERE order_id = p_order_id;

  v_prix_base := GREATEST(v_items_total - COALESCE(v_order.discount_amount, 0), 1);

  IF v_prix_base <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  END IF;

  IF v_prix_base < 10 OR v_prix_base > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount', 'amount', v_prix_base);
  END IF;

  SELECT id INTO v_blocking_id FROM payment_intents
    WHERE order_id = p_order_id AND statut IN ('confirmed', 'split_done', 'simulated', 'disputed')
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid', 'payment_intent_id', v_blocking_id);
  END IF;

  SELECT merchant_id INTO v_prestataire_id FROM shops WHERE id = v_order.shop_id;
  IF v_prestataire_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_not_found');
  END IF;

  v_idempotency_key := 'pay_' || p_order_id::text || '_' || v_prix_base::text || '_' || p_moyen_paiement;

  v_pi_id := public.create_payment_intent(
    p_order_id, p_client_id, v_prestataire_id,
    v_prix_base, p_moyen_paiement, v_idempotency_key
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'payment_intent_id', v_pi_id,
    'prix_base',         v_prix_base,
    'commission',        CEIL(v_prix_base * 0.01)::int,
    'montant_total',     v_prix_base + CEIL(v_prix_base * 0.01)::int,
    'prestataire_id',    v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) TO service_role;
