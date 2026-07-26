-- ===========================================================================
-- FIX MODÈLE ÉCONOMIQUE : LASSI garde sa commission AVANT le reversement
-- ---------------------------------------------------------------------------
-- AVANT : payout_queue.montant = prix_base
--         → LASSI envoyait le montant COMPLET au prestataire
--         → LASSI absorbait les frais OM Cash In (0.8%) de sa propre poche
--         → LASSI perdait de l'argent sur chaque commande
--
-- APRÈS : payout_montant = FLOOR((montant_reçu - commission_lassi) / (1 + frais_payout))
--         où montant_reçu = montant_total × (1 - frais_collect)
--
--   OM  : FLOOR((montant_total × 0.99 - commission_lassi) / 1.008)
--   Wave: FLOOR((montant_total × 0.99 - commission_lassi) / 1.01)
--
-- Résultat pour 255 FCFA (commission LASSI = 2.53, prix_base = 252.47) :
--   LASSI reçoit : 255 × 0.99 = 252.45 FCFA
--   LASSI garde  : 2.53 FCFA (commission) ✅
--   Prestataire  : FLOOR((252.45 - 2.53) / 1.008) = 247 FCFA
--   OM Cash In   : 247 × 0.8% = 1.98 FCFA (sur la part du prestataire)
--   LASSI net    : 252.45 - (247 × 1.008) = 252.45 - 249.98 = +2.47 FCFA ✅
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
  v_pi              public.payment_intents%ROWTYPE;
  v_pay_method      TEXT;
  v_payout_montant  NUMERIC;

  -- Frais fournisseurs (contrat OM + Wave)
  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;   -- 1% sur le paiement client
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;  -- 0.8% sur le Cash In prestataire
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;   -- 1% sur le checkout Wave
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;   -- 1% sur le payout Wave
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

  -- ─── CALCUL DU MONTANT NET PRESTATAIRE ────────────────────────────────────
  -- LASSI prend sa commission AVANT d'envoyer au prestataire.
  -- Étape 1 : ce que LASSI reçoit réellement = montant_total × (1 - frais_collect)
  -- Étape 2 : LASSI soustrait sa commission
  -- Étape 3 : ce qui reste est envoyé au prestataire, en tenant compte du frais payout
  --           Formule : X × (1 + frais_payout) = reste → X = reste / (1 + frais_payout)
  -- FLOOR() : arrondi à l'unité inférieure → LASSI garde toujours AU MOINS sa commission
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
      -- Paiement simulé ou moyen inconnu : pas de frais fournisseur
      v_pi.prix_base
  END;

  -- Garde de sécurité : montant invalide → bloquer le split
  IF v_payout_montant IS NULL OR v_payout_montant <= 0 OR v_payout_montant > v_pi.prix_base THEN
    RETURN jsonb_build_object(
      'ok',             false,
      'error',          'payout_amount_invalid',
      'payout_montant', v_payout_montant,
      'prix_base',      v_pi.prix_base
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

  -- 5. Mettre en file le reversement prestataire
  --    montant = v_payout_montant (pas prix_base)
  --    LASSI a déjà gardé sa commission — les frais fournisseur réduisent la part du prestataire
  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_payout_montant)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- 6. Journal audit
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

NOTIFY pgrst, 'reload schema';
