-- ===========================================================================
-- FIX : confirm_order_from_payment — ordre reste 'new' après paiement OM
-- ---------------------------------------------------------------------------
-- Problème : l'ordre passait automatiquement de 'new' → 'preparing' lors de
--   la confirmation de paiement OM, court-circuitant l'onglet "Nouvelles"
--   du prestataire. Il voyait 0 dans "Nouvelles" alors qu'une commande payée
--   venait d'arriver.
--
-- Fix : on n'avance plus le statut à 'preparing' automatiquement.
--   - Si l'ordre était 'pending' (edge-case) → on le passe à 'new' pour qu'il
--     apparaisse dans "Nouvelles".
--   - Si l'ordre était déjà 'new' → on le laisse à 'new'.
--   Le prestataire voit la commande dans "Nouvelles", l'accepte manuellement
--   (+ saisit le délai) → passe à 'preparing' (En cours).
-- ===========================================================================

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

  -- Paiement confirmé → l'ordre reste dans 'new' (visible dans "Nouvelles").
  -- Seul cas traité : 'pending' (commande créée sans paiement immédiat) → 'new'.
  -- Un ordre déjà 'new' n'est pas touché : le prestataire l'accepte manuellement.
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'new'
    WHERE id     = v_pi.order_id
      AND status = 'pending';
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
