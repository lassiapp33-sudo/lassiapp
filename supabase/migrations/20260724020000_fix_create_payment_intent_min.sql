-- Abaisse aussi le minimum dans create_payment_intent à 1 FCFA.
-- La même correction que 20260724010000 mais pour la fonction interne.

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id        UUID,
  p_client_id       UUID,
  p_prestataire_id  UUID,
  p_prix_base       INTEGER,
  p_moyen_paiement  TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_commission INTEGER;
  v_total      INTEGER;
  v_pi_id      UUID;
BEGIN
  SELECT id INTO v_pi_id
    FROM public.payment_intents
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_pi_id; END IF;

  -- 1% LASSI
  v_commission := CEIL(p_prix_base * 0.01);
  v_total      := p_prix_base + v_commission;

  -- Minimum 1 FCFA
  IF p_prix_base < 1 OR p_prix_base > 5000000 THEN
    RAISE EXCEPTION 'montant_invalide: % FCFA', p_prix_base;
  END IF;

  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RAISE EXCEPTION 'moyen_paiement_invalide: %', p_moyen_paiement;
  END IF;

  INSERT INTO public.payment_intents (
    order_id, client_id, prestataire_id,
    prix_base, commission_lassi, montant_total,
    moyen_paiement, idempotency_key, statut
  ) VALUES (
    p_order_id, p_client_id, p_prestataire_id,
    p_prix_base, v_commission, v_total,
    p_moyen_paiement, p_idempotency_key, 'pending'
  ) RETURNING id INTO v_pi_id;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (v_pi_id, 'created', jsonb_build_object(
    'prix_base',  p_prix_base,
    'commission', v_commission,
    'total',      v_total,
    'moyen',      p_moyen_paiement
  ));

  RETURN v_pi_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT) TO service_role;
