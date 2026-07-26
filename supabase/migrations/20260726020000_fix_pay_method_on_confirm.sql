-- FIX : confirm_order_from_payment ne mettait pas à jour orders.pay_method
-- Résultat : toutes les commandes affichaient "Payé via Wave" côté prestataire,
-- même celles payées via Orange Money.
-- Ce fix met à jour pay_method avec la vraie méthode depuis payment_intents.moyen_paiement.

CREATE OR REPLACE FUNCTION public.confirm_order_from_payment(
  p_payment_intent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi public.payment_intents%ROWTYPE;
  v_pay_method TEXT;
BEGIN
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  IF v_pi.statut = 'split_done' THEN
    RETURN jsonb_build_object(
      'ok',             true,
      'already_done',   true,
      'order_id',       v_pi.order_id,
      'reservation_id', v_pi.reservation_id
    );
  END IF;

  IF v_pi.statut NOT IN ('confirmed', 'simulated') THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'error',  'payment_not_confirmed',
      'statut', v_pi.statut
    );
  END IF;

  UPDATE public.payment_intents
  SET
    statut        = 'split_done',
    split_done_at = NOW(),
    updated_at    = NOW()
  WHERE id = p_payment_intent_id;

  -- Mapper moyen_paiement (payment_intents) → pay_method (orders)
  v_pay_method := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN 'om'
    WHEN 'wave'         THEN 'wave'
    ELSE v_pi.moyen_paiement
  END;

  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      status     = 'preparing',
      pay_method = v_pay_method
    WHERE id     = v_pi.order_id
      AND status IN ('pending', 'new');
  END IF;

  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE public.reservations_terrain
    SET statut     = 'paye',
        updated_at = NOW()
    WHERE id     = v_pi.reservation_id
      AND statut = 'en_attente';
  END IF;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    p_payment_intent_id,
    'split_done',
    jsonb_build_object(
      'order_id',       v_pi.order_id,
      'reservation_id', v_pi.reservation_id,
      'prix_base',      v_pi.prix_base,
      'commission',     v_pi.commission_lassi,
      'total',          v_pi.montant_total,
      'moyen_paiement', v_pi.moyen_paiement,
      'external_ref',   v_pi.external_ref
    )
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'order_id',       v_pi.order_id,
    'reservation_id', v_pi.reservation_id,
    'montant_total',  v_pi.montant_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_from_payment(UUID) TO service_role;
