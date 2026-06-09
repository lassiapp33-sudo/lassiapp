-- ============================================================
-- RPC : confirm_order_from_payment
-- Appelée par l'Edge Function webhook-payment après confirmation Wave/OM.
-- Atomique + idempotente : safe si appelée deux fois (réseau, retry).
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_order_from_payment(
  p_payment_intent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pi payment_intents%ROWTYPE;
BEGIN
  -- Verrouillage pour éviter le double-traitement en cas de retry concurrent
  SELECT * INTO v_pi
  FROM payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotency : déjà traité → retourner succès sans rien modifier
  IF v_pi.statut = 'split_done' THEN
    RETURN jsonb_build_object(
      'ok',              true,
      'already_done',    true,
      'order_id',        v_pi.order_id,
      'reservation_id',  v_pi.reservation_id
    );
  END IF;

  -- Garde : seuls 'confirmed' et 'simulated' peuvent avancer
  IF v_pi.statut NOT IN ('confirmed', 'simulated') THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'error',  'payment_not_confirmed',
      'statut', v_pi.statut
    );
  END IF;

  -- 1. Marquer le paiement comme split effectué
  UPDATE payment_intents
  SET
    statut        = 'split_done',
    split_done_at = NOW(),
    updated_at    = NOW()
  WHERE id = p_payment_intent_id;

  -- 2. Activer la commande classique (si liée)
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE orders
    SET status = 'preparing'
    WHERE id     = v_pi.order_id
      AND status IN ('pending', 'new');
  END IF;

  -- 3. Activer la réservation terrain (si liée)
  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE reservations_terrain
    SET statut     = 'paye',
        updated_at = NOW()
    WHERE id     = v_pi.reservation_id
      AND statut = 'en_attente';
  END IF;

  -- 4. Journal audit (immuable)
  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
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

-- Service role (Edge Functions) peut appeler cette fonction
GRANT EXECUTE ON FUNCTION confirm_order_from_payment(UUID) TO service_role;
