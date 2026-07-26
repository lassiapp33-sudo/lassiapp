-- ===========================================================================
-- CORRECTION CRITIQUE : confirm_order_from_payment
-- La migration 20260726020000 (fix pay_method) avait écrasé la fonction
-- sans conserver l'INSERT INTO payout_queue — les reversements prestataires
-- n'étaient donc jamais mis en file d'attente.
-- Ce fichier remet la version complète avec :
--   - pay_method mis à jour (fix 20260726020000)
--   - INSERT payout_queue restauré (fix original 20260610040000)
--   - SET search_path = '' (sécurité 20260726000000)
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
  v_pi         public.payment_intents%ROWTYPE;
  v_pay_method TEXT;
BEGIN
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotence : déjà traité → retourner succès sans rien modifier
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

  -- 1. Marquer le paiement comme split effectué
  UPDATE public.payment_intents
  SET
    statut        = 'split_done',
    split_done_at = NOW(),
    updated_at    = NOW()
  WHERE id = p_payment_intent_id;

  -- 2. Mapper moyen_paiement → pay_method (format orders)
  v_pay_method := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN 'om'
    WHEN 'wave'         THEN 'wave'
    ELSE v_pi.moyen_paiement
  END;

  -- 3. Activer la commande + corriger la méthode de paiement affichée
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      status     = 'preparing',
      pay_method = v_pay_method
    WHERE id     = v_pi.order_id
      AND status IN ('pending', 'new');
  END IF;

  -- 4. Activer la réservation terrain (si liée)
  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE public.reservations_terrain
    SET statut     = 'paye',
        updated_at = NOW()
    WHERE id     = v_pi.reservation_id
      AND statut = 'en_attente';
  END IF;

  -- 5. Mettre en file le reversement prestataire (montant hors commission LASSI)
  --    ON CONFLICT DO NOTHING : idempotence si appelé deux fois pour le même paiement
  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_pi.prix_base)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- 6. Journal audit (immuable)
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
      'pay_method',     v_pay_method,
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
