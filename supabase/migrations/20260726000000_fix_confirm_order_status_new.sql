-- ===========================================================================
-- FIX : confirm_order_from_payment — sécurité search_path + transition correcte
-- ---------------------------------------------------------------------------
-- Avant : 'new' → 'preparing' automatiquement dès confirmation paiement
--         (cohérent avec getShopOrders qui affiche les statuts > 'new')
-- Après fix getShopOrders : les commandes 'new' sont déjà visibles avant paiement.
--         Webhook confirme paiement → 'preparing' : prestataire sait que c'est payé.
--
-- Ce fichier ajoute aussi SET search_path = '' (sécurité SECURITY DEFINER)
-- et préfixe toutes les tables avec public.
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

  -- Paiement confirmé → 'preparing' : prestataire sait que le paiement est reçu
  -- ('new' = commande créée non payée, 'preparing' = commande payée et en cours)
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'preparing'
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
