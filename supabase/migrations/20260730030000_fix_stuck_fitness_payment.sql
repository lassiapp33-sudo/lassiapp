-- ===========================================================================
-- FIX : paiement fitness OM bloqué du 2026-07-30 ~14h31
-- Le webhook OM n'a pas activé l'abonnement (metadata column manquante).
-- Ce script : confirme le pi → split_done + payout_queue + active l'abonnement.
-- Idempotent : ON CONFLICT DO NOTHING partout.
-- ===========================================================================
DO $$
DECLARE
  v_pi_id  UUID;
  v_pi     public.payment_intents%ROWTYPE;
  v_meta   JSONB;
  v_offre_id    UUID;
  v_offre_nom   TEXT;
  v_duree_jours INT;
  v_date_exp    TIMESTAMPTZ;
  v_result      JSONB;
BEGIN
  -- Trouver le(s) paiement(s) fitness OM bloqué(s) aujourd'hui
  SELECT id INTO v_pi_id
  FROM public.payment_intents
  WHERE statut IN ('initiated', 'confirmed')
    AND moyen_paiement = 'orange_money'
    AND created_at >= '2026-07-30 14:00:00'
    AND order_id IS NULL
    AND reservation_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pi_id IS NULL THEN
    RAISE NOTICE 'Aucun paiement fitness OM bloqué trouvé — déjà traité ?';
    RETURN;
  END IF;

  RAISE NOTICE 'Traitement payment_intent: %', v_pi_id;

  -- 1. Passer en "confirmed" si encore en "initiated"
  UPDATE public.payment_intents
  SET
    statut       = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    external_status = COALESCE(external_status, 'SUCCESS_MANUAL'),
    updated_at   = NOW()
  WHERE id = v_pi_id AND statut = 'initiated';

  -- 2. Recharger le pi (avec la colonne metadata maintenant disponible)
  SELECT * INTO v_pi FROM public.payment_intents WHERE id = v_pi_id;

  -- 3. confirm_order_from_payment → split_done + INSERT payout_queue (reversement prestataire)
  SELECT public.confirm_order_from_payment(v_pi_id) INTO v_result;
  RAISE NOTICE 'confirm_order_from_payment: %', v_result;

  -- 4. Activer l'abonnement si pas encore fait
  IF NOT EXISTS (
    SELECT 1 FROM public.fitness_abonnements_clients WHERE payment_intent_id = v_pi_id
  ) THEN
    v_meta        := v_pi.metadata;
    v_offre_id    := (v_meta->>'offre_id')::UUID;
    v_offre_nom   := v_meta->>'offre_nom';
    v_duree_jours := COALESCE((v_meta->>'duree_jours')::INT, 30);
    v_date_exp    := NOW() + (v_duree_jours || ' days')::INTERVAL;

    INSERT INTO public.fitness_abonnements_clients (
      offre_id, client_id, prestataire_id, nom_offre, prix_paye,
      date_achat, date_expiration, statut, payment_intent_id
    ) VALUES (
      v_offre_id, v_pi.client_id, v_pi.prestataire_id, v_offre_nom,
      v_pi.montant_total, NOW(), v_date_exp, 'actif', v_pi_id
    );

    -- Notification in-app pour le client (type 'payment' = clé DB, app mappe vers 'pay')
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_pi.client_id, 'payment',
      'Abonnement activé',
      'Ton abonnement « ' || COALESCE(v_offre_nom, 'fitness') || ' » est maintenant actif.',
      jsonb_build_object('type', 'fitness_abonnement')
    );

    RAISE NOTICE 'Abonnement fitness activé pour client %', v_pi.client_id;
  ELSE
    RAISE NOTICE 'Abonnement déjà existant pour ce payment_intent';
  END IF;

  -- 5. Vérifier que payout_queue a bien l'entrée
  IF NOT EXISTS (SELECT 1 FROM public.payout_queue WHERE payment_intent_id = v_pi_id) THEN
    -- Insérer manuellement si confirm_order_from_payment n'a pas pu le faire
    INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
    VALUES (v_pi_id, v_pi.prestataire_id, v_pi.prix_base)
    ON CONFLICT (payment_intent_id) DO NOTHING;
    RAISE NOTICE 'payout_queue inséré manuellement pour prestataire %', v_pi.prestataire_id;
  ELSE
    RAISE NOTICE 'payout_queue déjà présent';
  END IF;

END $$;
