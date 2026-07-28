-- ===========================================================================
-- FIX : confirm_order_from_payment → INSERT INTO payments (historique client)
-- ---------------------------------------------------------------------------
-- Problème : la table payments (historique client/prestataire) n'était jamais
-- alimentée lors d'un paiement Wave/OM réel. Tout le flux passait par
-- payment_intents mais rien n'écrivait dans payments.
-- Résultat : écran "Mes paiements" client = toujours vide malgré des paiements réels.
--
-- Fix : ajouter un INSERT INTO public.payments dans confirm_order_from_payment
-- juste après l'INSERT payout_queue. L'UUID du payment_intent est réutilisé
-- comme PK de la ligne payments (idempotence naturelle via ON CONFLICT DO NOTHING).
--
-- Réconciliation immédiate : le DO block final insère les lignes payments
-- manquantes pour tous les payment_intents split_done existants.
-- ===========================================================================


-- ============================================================
-- PARTIE 1 : confirm_order_from_payment — ajout INSERT payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_order_from_payment(
  p_payment_intent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi             public.payment_intents%ROWTYPE;
  v_payout_montant NUMERIC;
  v_items          JSONB := '[]'::JSONB;

  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;
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
      'ok', true, 'already_done', true,
      'order_id', v_pi.order_id, 'reservation_id', v_pi.reservation_id
    );
  END IF;

  IF v_pi.statut NOT IN ('confirmed', 'simulated') THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'payment_not_confirmed', 'statut', v_pi.statut
    );
  END IF;

  -- Montant net prestataire (LASSI garde commission + couvre frais Cash In)
  v_payout_montant := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN
      FLOOR((v_pi.montant_total * (1 - OM_MERCHANT_FEE) - v_pi.commission_lassi) / (1 + OM_CASHIN_FEE))
    WHEN 'wave' THEN
      FLOOR((v_pi.montant_total * (1 - WAVE_COLLECT_FEE) - v_pi.commission_lassi) / (1 + WAVE_PAYOUT_FEE))
    ELSE
      v_pi.prix_base
  END;

  IF v_payout_montant IS NULL OR v_payout_montant <= 0 OR v_payout_montant > v_pi.prix_base THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'payout_amount_invalid',
      'payout_montant', v_payout_montant, 'prix_base', v_pi.prix_base
    );
  END IF;

  -- Items de la commande (pour l'affichage dans le reçu client)
  IF v_pi.order_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', oi.product_name, 'qty', oi.qty, 'price', oi.unit_price)),
      '[]'::JSONB
    ) INTO v_items
    FROM public.order_items oi
    WHERE oi.order_id = v_pi.order_id;
  END IF;

  -- 1. split_done
  UPDATE public.payment_intents
  SET statut = 'split_done', split_done_at = NOW(), updated_at = NOW()
  WHERE id = p_payment_intent_id;

  -- 2. Commande → reste 'new' dans "Nouvelles" du prestataire
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'new'
    WHERE id = v_pi.order_id AND status = 'pending';
  END IF;

  -- 3. Réservation terrain → payée
  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE public.reservations_terrain
    SET statut = 'paye', updated_at = NOW()
    WHERE id = v_pi.reservation_id AND statut = 'en_attente';
  END IF;

  -- 4. File reversement prestataire
  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_payout_montant::INTEGER)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- 5. Historique client/prestataire dans payments
  --    UUID réutilisé = idempotence garantie (ON CONFLICT DO NOTHING si appelé deux fois)
  INSERT INTO public.payments (
    id, order_id, client_id, prestataire_id,
    amount, method, status, reference, items
  )
  VALUES (
    p_payment_intent_id,
    v_pi.order_id,
    v_pi.client_id,
    v_pi.prestataire_id,
    v_pi.montant_total,
    CASE v_pi.moyen_paiement WHEN 'orange_money' THEN 'om' ELSE 'wave' END,
    'success',
    v_pi.external_ref,
    v_items
  )
  ON CONFLICT (id) DO NOTHING;

  -- 6. Audit immuable
  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    p_payment_intent_id, 'split_done',
    jsonb_build_object(
      'order_id',       v_pi.order_id,
      'reservation_id', v_pi.reservation_id,
      'prix_base',      v_pi.prix_base,
      'commission',     v_pi.commission_lassi,
      'total',          v_pi.montant_total,
      'payout_montant', v_payout_montant,
      'moyen_paiement', v_pi.moyen_paiement,
      'external_ref',   v_pi.external_ref
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_pi.order_id,
    'reservation_id', v_pi.reservation_id,
    'montant_total', v_pi.montant_total,
    'payout_montant', v_payout_montant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_from_payment(UUID) TO service_role;


-- ============================================================
-- PARTIE 2 : Réconciliation immédiate
-- Insère les lignes payments manquantes pour tous les payment_intents
-- split_done qui n'ont pas encore d'entrée dans payments.
-- ============================================================
DO $$
DECLARE
  v_pi    public.payment_intents%ROWTYPE;
  v_items JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_pi IN
    SELECT pi.*
    FROM public.payment_intents pi
    WHERE pi.statut = 'split_done'
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p WHERE p.id = pi.id
      )
  LOOP
    v_items := '[]'::JSONB;
    IF v_pi.order_id IS NOT NULL THEN
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('name', oi.product_name, 'qty', oi.qty, 'price', oi.unit_price)),
        '[]'::JSONB
      ) INTO v_items
      FROM public.order_items oi WHERE oi.order_id = v_pi.order_id;
    END IF;

    INSERT INTO public.payments (
      id, order_id, client_id, prestataire_id,
      amount, method, status, reference, items
    )
    VALUES (
      v_pi.id,
      v_pi.order_id,
      v_pi.client_id,
      v_pi.prestataire_id,
      v_pi.montant_total,
      CASE v_pi.moyen_paiement WHEN 'orange_money' THEN 'om' ELSE 'wave' END,
      'success',
      v_pi.external_ref,
      v_items
    )
    ON CONFLICT (id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '[lassi] payments reconciled: %', v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
