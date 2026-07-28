-- ===========================================================================
-- FIX CRITIQUE (3ème occurrence) : confirm_order_from_payment + auto-guérison
-- ---------------------------------------------------------------------------
-- HISTORIQUE DES REGRESSIONS :
--   20260726020000 → a écrasé confirm_order_from_payment sans l'INSERT payout_queue
--   20260726030000 → a restauré l'INSERT
--   20260726050000 → a ajouté le calcul commission-first
--   20260728000000 → a RE-écrasé confirm_order_from_payment (fix order 'new')
--                    SANS conserver l'INSERT payout_queue → bug silencieux
--
-- CETTE MIGRATION :
--   1. Fusionne TOUS les correctifs précédents en une seule version finale
--   2. Ajoute reconcile_missing_payouts() : détecte et répare en temps réel
--      les payment_intents split_done sans entrée payout_queue
--   3. Réconciliation immédiate des paiements bloqués (DO block)
--   4. L'EF process-payouts appellera reconcile_missing_payouts() à chaque tick
-- ===========================================================================


-- ============================================================
-- PARTIE 1 : confirm_order_from_payment — VERSION DÉFINITIVE
-- Fusionne :
--   20260726030000 → INSERT payout_queue
--   20260726050000 → calcul commission-first (LASSI garde sa marge)
--   20260728000000 → ordre reste 'new' dans "Nouvelles" du prestataire
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

  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;   -- 1%  : frais OM sur paiement client
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;  -- 0.8%: frais OM Cash In prestataire
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;   -- 1%  : frais Wave checkout
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;   -- 1%  : frais Wave payout
BEGIN
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotence : déjà traité → rien modifier
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

  -- Montant net prestataire : LASSI prend sa commission ET couvre les frais Cash In
  -- Formule : (montant_reçu_lassi - commission_lassi) / (1 + frais_cashin)
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
      v_pi.prix_base  -- simulé : aucun frais fournisseur
  END;

  -- Garde de sécurité : montant incohérent → bloquer sans crasher
  IF v_payout_montant IS NULL OR v_payout_montant <= 0 OR v_payout_montant > v_pi.prix_base THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'payout_amount_invalid',
      'payout_montant', v_payout_montant, 'prix_base', v_pi.prix_base,
      'total', v_pi.montant_total, 'commission', v_pi.commission_lassi
    );
  END IF;

  -- 1. Marquer split effectué
  UPDATE public.payment_intents
  SET statut = 'split_done', split_done_at = NOW(), updated_at = NOW()
  WHERE id = p_payment_intent_id;

  -- 2. Commande → reste 'new' dans "Nouvelles" du prestataire
  --    (uniquement si encore 'pending' — 'new' et au-delà restent inchangés)
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

  -- 4. File de reversement prestataire
  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_payout_montant::INTEGER)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- 5. Audit immuable
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
-- PARTIE 2 : reconcile_missing_payouts — filet de sécurité permanent
-- Détecte les payment_intents split_done sans entrée payout_queue
-- (régression de migration) et les insère automatiquement.
-- Appelée par process-payouts à chaque tick CRON.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_missing_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi             public.payment_intents%ROWTYPE;
  v_payout_montant NUMERIC;
  v_count          INTEGER := 0;

  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;
BEGIN
  -- Fenêtre de 30 jours : éviter de toucher d'anciens paiements hors scope
  FOR v_pi IN
    SELECT pi.*
    FROM public.payment_intents pi
    WHERE pi.statut = 'split_done'
      AND pi.split_done_at >= NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.payout_queue pq
        WHERE pq.payment_intent_id = pi.id
      )
    FOR UPDATE SKIP LOCKED
  LOOP
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

    -- Montant incohérent → skip (ne jamais envoyer un montant douteux)
    CONTINUE WHEN v_payout_montant IS NULL
               OR v_payout_montant <= 0
               OR v_payout_montant > v_pi.prix_base;

    INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
    VALUES (v_pi.id, v_pi.prestataire_id, v_payout_montant::INTEGER)
    ON CONFLICT (payment_intent_id) DO NOTHING;

    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      v_pi.id, 'payout_reconciled',
      jsonb_build_object(
        'payout_montant', v_payout_montant,
        'moyen_paiement', v_pi.moyen_paiement,
        'reconciled_at',  NOW()
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reconciled', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_missing_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_missing_payouts() TO service_role;


-- ============================================================
-- PARTIE 3 : Réconciliation immédiate des paiements bloqués
-- Répare les paiements split_done sans payout_queue existants.
-- ============================================================
DO $$
DECLARE
  result JSONB;
BEGIN
  SELECT public.reconcile_missing_payouts() INTO result;
  RAISE NOTICE '[lassi] reconcile_missing_payouts: %', result;
END;
$$;

NOTIFY pgrst, 'reload schema';
