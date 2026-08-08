-- ===========================================================================
-- FIX COMPLET : statut commande + pay_method + payout_queue
-- ---------------------------------------------------------------------------
-- Problèmes corrigés :
--
-- 1. create_order_atomic créait toutes les commandes au statut 'new' avec
--    pay_method = 'wave' en dur.
--    → Une commande Wave/OM apparaissait immédiatement dans l'historique
--      client et chez le prestataire, même si le paiement n'était pas reçu.
--    → La méthode de paiement affichée était toujours "Wave" même pour OM.
--
-- 2. confirm_order_from_payment (migration 20260728) avait retiré :
--    a) la mise à jour de pay_method lors de la confirmation OM/Wave
--    b) l'insertion dans payout_queue → les prestataires n'étaient plus payés
--
-- Corrections :
--   A. create_order_atomic accepte p_pay_method ; crée avec status='pending'
--      pour wave/om, 'new' pour cash.
--   B. confirm_order_from_payment restaure pay_method + payout_queue +
--      garde status='new' (visible dans "Nouvelles" prestataire).
-- ===========================================================================

-- ① DROP de l'ancienne signature (10 params) pour éviter PGRST203
DROP FUNCTION IF EXISTS public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
);

-- ② Nouvelle create_order_atomic avec p_pay_method
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_shop_id         UUID,
  p_client_id       UUID,
  p_client_name     TEXT,
  p_total           NUMERIC,
  p_discount_amount NUMERIC,
  p_promo_label     TEXT,
  p_order_type      TEXT,
  p_note            TEXT,
  p_idempotency_key TEXT,
  p_items           JSONB,
  p_pay_method      TEXT DEFAULT 'wave'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_order_id UUID;
  v_status   TEXT;
  v_pm       TEXT;
BEGIN
  v_pm := COALESCE(p_pay_method, 'wave');
  -- Paiements mobiles → pending (invisible jusqu'à confirmation)
  -- Cash → new (visible immédiatement)
  v_status := CASE WHEN v_pm IN ('wave', 'om') THEN 'pending' ELSE 'new' END;

  INSERT INTO public.orders (
    shop_id, client_id, client_name,
    total, discount_amount, promo_label,
    status, pay_method, order_type,
    note, idempotency_key
  )
  VALUES (
    p_shop_id, p_client_id, p_client_name,
    p_total, p_discount_amount, p_promo_label,
    v_status, v_pm, p_order_type,
    p_note, p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_name, qty, unit_price)
  SELECT
    v_order_id,
    (item ->> 'product_name')::TEXT,
    (item ->> 'qty')::INTEGER,
    (item ->> 'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  IF p_total > 100000 THEN
    BEGIN
      PERFORM public.raise_fraud_flag(
        'high_amount', 'order', v_order_id::text, 'medium',
        jsonb_build_object('total', p_total, 'shop_id', p_shop_id, 'client_id', p_client_id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
) TO service_role;

-- ③ Restauration complète de confirm_order_from_payment
--    (migration 20260728 avait retiré pay_method + payout_queue par accident)
--    Comportement final :
--      - status 'pending' → 'new' (prestataire voit la commande dans "Nouvelles")
--      - pay_method mis à jour avec le vrai moyen (om/wave)
--      - payout_queue alimenté avec le montant net prestataire
CREATE OR REPLACE FUNCTION public.confirm_order_from_payment(
  p_payment_intent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi              public.payment_intents%ROWTYPE;
  v_pay_method      TEXT;
  v_payout_montant  NUMERIC;

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

  -- Calcul du montant net prestataire (après frais LASSI + frais fournisseur)
  v_payout_montant := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN
      FLOOR(
        (v_pi.montant_total * (1 - OM_MERCHANT_FEE) - v_pi.commission_lassi)
        / (1 + OM_CASHIN_FEE)
      )
    WHEN 'wave' THEN
      FLOOR(
        (v_pi.montant_total * (1 - WAVE_COLLECT_FEE) - v_pi.commission_lassi)
        / (1 + WAVE_PAYOUT_FEE)
      )
    ELSE
      v_pi.prix_base
  END;

  IF v_payout_montant IS NULL OR v_payout_montant <= 0 OR v_payout_montant > v_pi.prix_base THEN
    RETURN jsonb_build_object(
      'ok',             false,
      'error',          'payout_amount_invalid',
      'payout_montant', v_payout_montant,
      'prix_base',      v_pi.prix_base
    );
  END IF;

  -- Mapper moyen_paiement (payment_intents) → pay_method (orders)
  v_pay_method := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN 'om'
    WHEN 'wave'         THEN 'wave'
    ELSE v_pi.moyen_paiement
  END;

  -- Marquer le paiement comme traité
  UPDATE public.payment_intents
  SET
    statut        = 'split_done',
    split_done_at = NOW(),
    updated_at    = NOW()
  WHERE id = p_payment_intent_id;

  -- Activer la commande + corriger le moyen de paiement affiché
  -- 'pending' (non payée) → 'new' (visible dans "Nouvelles" prestataire)
  -- Une commande déjà 'new' n'est pas touchée.
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      status     = 'new',
      pay_method = v_pay_method
    WHERE id     = v_pi.order_id
      AND status = 'pending';
  END IF;

  -- Activer la réservation terrain (si liée)
  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE public.reservations_terrain
    SET statut     = 'paye',
        updated_at = NOW()
    WHERE id     = v_pi.reservation_id
      AND statut = 'en_attente';
  END IF;

  -- Mettre en file le reversement prestataire
  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_payout_montant)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- Journal audit
  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    p_payment_intent_id,
    'split_done',
    jsonb_build_object(
      'order_id',        v_pi.order_id,
      'reservation_id',  v_pi.reservation_id,
      'prix_base',       v_pi.prix_base,
      'commission',      v_pi.commission_lassi,
      'total',           v_pi.montant_total,
      'moyen_paiement',  v_pi.moyen_paiement,
      'pay_method',      v_pay_method,
      'payout_montant',  v_payout_montant,
      'external_ref',    v_pi.external_ref
    )
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'order_id',       v_pi.order_id,
    'reservation_id', v_pi.reservation_id,
    'montant_total',  v_pi.montant_total,
    'payout_montant', v_payout_montant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_from_payment(UUID) TO service_role;
