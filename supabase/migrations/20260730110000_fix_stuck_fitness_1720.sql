-- Fix paiement fitness OM bloqué du 2026-07-30 ~17h20 (MP260730.1720.C48417)
-- Même logique que 20260730030000 mais pour le paiement de 17h20.
DO $$
DECLARE
  v_pi_id  UUID;
  v_pi     public.payment_intents%ROWTYPE;
  v_meta   JSONB;
  v_offre_id    UUID;
  v_offre_nom   TEXT;
  v_duree_jours INT;
  v_date_exp    TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_pi_id
  FROM public.payment_intents
  WHERE statut IN ('initiated', 'confirmed', 'pending')
    AND moyen_paiement = 'orange_money'
    AND created_at >= '2026-07-30 17:00:00'
    AND order_id IS NULL
    AND reservation_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pi_id IS NULL THEN
    RAISE NOTICE 'Aucun paiement fitness OM bloqué à 17h20 — déjà traité ?';
    RETURN;
  END IF;

  RAISE NOTICE 'Traitement payment_intent 17h20: %', v_pi_id;

  UPDATE public.payment_intents
  SET statut = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, NOW()),
      external_status = COALESCE(external_status, 'SUCCESS_MANUAL'),
      updated_at = NOW()
  WHERE id = v_pi_id AND statut IN ('initiated', 'pending');

  SELECT * INTO v_pi FROM public.payment_intents WHERE id = v_pi_id;

  PERFORM public.confirm_order_from_payment(v_pi_id);

  IF NOT EXISTS (SELECT 1 FROM public.fitness_abonnements_clients WHERE payment_intent_id = v_pi_id) THEN
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

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_pi.client_id, 'payment',
      'Abonnement activé',
      'Ton abonnement « ' || COALESCE(v_offre_nom, 'fitness') || ' » est maintenant actif.',
      jsonb_build_object('type', 'fitness_abonnement')
    );

    RAISE NOTICE 'Abonnement 17h20 activé pour client %', v_pi.client_id;
  ELSE
    RAISE NOTICE 'Abonnement 17h20 déjà existant';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payout_queue WHERE payment_intent_id = v_pi_id) THEN
    INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
    VALUES (v_pi_id, v_pi.prestataire_id, v_pi.prix_base)
    ON CONFLICT (payment_intent_id) DO NOTHING;
    RAISE NOTICE 'payout_queue inséré manuellement';
  ELSE
    RAISE NOTICE 'payout_queue déjà présent';
  END IF;
END $$;
