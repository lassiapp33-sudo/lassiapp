-- ===========================================================================
-- LASSI — Section 3 : Système de paiement blindé
-- ---------------------------------------------------------------------------
-- 3.1 initiate_order_payment(order_id, client_id, moyen_paiement)
--     Recharge la commande depuis la base, recalcule le montant depuis les
--     vraies lignes (order_items), vérifie la cohérence (propriété, statut,
--     plafond, absence de paiement déjà abouti), dérive le prestataire depuis
--     la boutique, génère une clé d'idempotence déterministe et crée le
--     payment_intent en 'pending'. Le client n'envoie jamais de montant.
--
-- 3.2 process_payment_webhook(...)
--     Traitement atomique et idempotent du webhook Wave/OM : dédoublonnage
--     par external_event_id (payment_logs), anti-rejeu (le payment_intent
--     doit être pending/initiated), vérification du montant reçu == attendu
--     (sinon 'disputed'), puis confirmation + activation commande/réservation
--     + mise en file payout_queue, le tout dans une seule transaction SQL.
-- ===========================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 1. payment_intents.statut : ajouter 'disputed' (écart de montant détecté
--    sur webhook — argent non reversé tant que l'admin n'a pas tranché)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_intents DROP CONSTRAINT payment_intents_statut_check;
ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_statut_check
  CHECK (statut = ANY (ARRAY[
    'pending', 'initiated', 'confirmed', 'split_done',
    'failed', 'refunded', 'simulated', 'disputed'
  ]));


-- ───────────────────────────────────────────────────────────────────────────
-- 2. payment_logs : colonne de déduplication des événements webhook
--    (= "payment_events" du kit sécurité). Index unique partiel : un même
--    external_event_id ne peut être inséré qu'une seule fois.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_logs ADD COLUMN external_event_id TEXT;

CREATE UNIQUE INDEX payment_logs_external_event_id_key
  ON public.payment_logs (external_event_id)
  WHERE external_event_id IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. payout_queue : file des reversements prestataires une fois le paiement
--    confirmé. Remplie par confirm_order_from_payment, jamais par le client.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payout_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id   UUID NOT NULL UNIQUE REFERENCES public.payment_intents(id),
  prestataire_id      UUID NOT NULL REFERENCES public.profiles(id),
  montant             INTEGER NOT NULL CHECK (montant > 0),
  statut              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (statut IN ('queued', 'processing', 'paid', 'failed')),
  external_payout_ref TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ
);

ALTER TABLE public.payout_queue ENABLE ROW LEVEL SECURITY;

-- Lecture seule : le prestataire voit ses reversements, l'admin voit tout.
-- Aucune écriture cliente : seules les fonctions SECURITY DEFINER écrivent ici.
REVOKE ALL ON public.payout_queue FROM anon, authenticated;
GRANT SELECT ON public.payout_queue TO authenticated;

CREATE POLICY payout_queue_prestataire_read ON public.payout_queue
  FOR SELECT TO authenticated
  USING (prestataire_id = auth.uid());

CREATE POLICY payout_queue_admin_read ON public.payout_queue
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));


-- ───────────────────────────────────────────────────────────────────────────
-- 4. initiate_order_payment — Section 3.1
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.initiate_order_payment(
  p_order_id       UUID,
  p_client_id      UUID,
  p_moyen_paiement TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order          RECORD;
  v_prestataire_id UUID;
  v_items_total    INTEGER;
  v_prix_base      INTEGER;
  v_idempotency_key TEXT;
  v_pi_id          UUID;
  v_blocking_id    UUID;
BEGIN
  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_method');
  END IF;

  -- Recharger la commande + verrou (empêche une double-initiation concurrente)
  SELECT id, client_id, shop_id, status, total, discount_amount
    INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.client_id <> p_client_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_order.status <> 'new' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  END IF;

  -- Recalcul du montant depuis les vraies lignes de la commande (jamais le client)
  SELECT COALESCE(SUM(qty * unit_price), 0) INTO v_items_total
    FROM order_items WHERE order_id = p_order_id;

  -- Même plancher que create-order : total = max(sous-total - remise, 1)
  v_prix_base := GREATEST(v_items_total - COALESCE(v_order.discount_amount, 0), 1);

  -- Garde-fou : la commande doit rester cohérente avec ses lignes ; en cas
  -- d'écart on bloque plutôt que de faire confiance à orders.total (fail-safe)
  IF v_prix_base <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  END IF;

  IF v_prix_base < 100 OR v_prix_base > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount', 'amount', v_prix_base);
  END IF;

  -- Aucune transaction déjà aboutie (ou litigieuse) pour cette commande
  SELECT id INTO v_blocking_id FROM payment_intents
    WHERE order_id = p_order_id AND statut IN ('confirmed', 'split_done', 'simulated', 'disputed')
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid', 'payment_intent_id', v_blocking_id);
  END IF;

  -- Le prestataire est dérivé de la boutique de la commande, jamais du client
  SELECT merchant_id INTO v_prestataire_id FROM shops WHERE id = v_order.shop_id;
  IF v_prestataire_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_not_found');
  END IF;

  -- Clé déterministe : même commande + même montant + même moyen → même
  -- payment_intent (create_payment_intent gère la déduplication par clé)
  v_idempotency_key := 'pay_' || p_order_id::text || '_' || v_prix_base::text || '_' || p_moyen_paiement;

  v_pi_id := public.create_payment_intent(
    p_order_id, p_client_id, v_prestataire_id,
    v_prix_base, p_moyen_paiement, v_idempotency_key
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'payment_intent_id', v_pi_id,
    'prix_base',       v_prix_base,
    'commission',      CEIL(v_prix_base * 0.01)::int,
    'montant_total',   v_prix_base + CEIL(v_prix_base * 0.01)::int,
    'prestataire_id',  v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. confirm_order_from_payment — ajout de la mise en file payout_queue
--    (logique d'activation commande/réservation inchangée)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_order_from_payment(p_payment_intent_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pi payment_intents%ROWTYPE;
BEGIN
  -- Verrouillage pour éviter le double-traitement en cas de retry concurrent
  SELECT * INTO v_pi
  FROM payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotency : déjà traité → retourner succès sans rien modifier
  IF v_pi.statut = 'split_done' THEN
    RETURN jsonb_build_object(
      'ok',              true,
      'already_done',    true,
      'order_id',        v_pi.order_id,
      'reservation_id',  v_pi.reservation_id
    );
  END IF;

  -- Garde : seuls 'confirmed' et 'simulated' peuvent avancer
  IF v_pi.statut NOT IN ('confirmed', 'simulated') THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'error',  'payment_not_confirmed',
      'statut', v_pi.statut
    );
  END IF;

  -- 1. Marquer le paiement comme split effectué
  UPDATE payment_intents
  SET
    statut        = 'split_done',
    split_done_at = NOW(),
    updated_at    = NOW()
  WHERE id = p_payment_intent_id;

  -- 2. Activer la commande classique (si liée)
  IF v_pi.order_id IS NOT NULL THEN
    UPDATE orders
    SET status = 'preparing'
    WHERE id     = v_pi.order_id
      AND status IN ('pending', 'new');
  END IF;

  -- 3. Activer la réservation terrain (si liée)
  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE reservations_terrain
    SET statut     = 'paye',
        updated_at = NOW()
    WHERE id     = v_pi.reservation_id
      AND statut = 'en_attente';
  END IF;

  -- 4. Mettre en file le reversement prestataire (part hors commission LASSİ)
  INSERT INTO payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_pi.prix_base)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  -- 5. Journal audit (immuable)
  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
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
$function$;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. process_payment_webhook — Section 3.2
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_external_event_id TEXT,
  p_payment_intent_id UUID,
  p_source            TEXT,
  p_external_status   TEXT,
  p_external_ref      TEXT,
  p_received_amount   INTEGER,
  p_is_success        BOOLEAN,
  p_raw_payload       JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pi     payment_intents%ROWTYPE;
  v_log_id UUID;
  v_confirm JSONB;
BEGIN
  -- Recharger + verrouiller le payment_intent AVANT toute écriture dans
  -- payment_logs (contrainte FK : impossible de logguer un id inexistant)
  SELECT * INTO v_pi FROM payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- 3. Idempotence : un même événement Wave/OM ne doit être traité qu'une fois
  --    (les webhooks peuvent être renvoyés plusieurs fois par le fournisseur)
  INSERT INTO payment_logs (payment_intent_id, event_type, event_data, external_event_id)
  VALUES (
    p_payment_intent_id, 'webhook_received',
    jsonb_build_object('source', p_source, 'status', p_external_status, 'payload', p_raw_payload),
    p_external_event_id
  )
  ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_log_id;

  IF v_log_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- 5. Anti-rejeu : on ne traite que les paiements encore en attente
  IF v_pi.statut NOT IN ('pending', 'initiated') THEN
    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'webhook_ignored',
            jsonb_build_object('reason', 'not_pending', 'statut', v_pi.statut, 'source', p_source));

    RETURN jsonb_build_object('ok', true, 'ignored', true, 'reason', 'not_pending', 'statut', v_pi.statut);
  END IF;

  -- Échec côté fournisseur (paiement annulé / refusé)
  IF NOT p_is_success THEN
    UPDATE payment_intents SET
      statut          = 'failed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'failed',
            jsonb_build_object('source', p_source, 'external_status', p_external_status));

    RETURN jsonb_build_object('ok', true, 'statut', 'failed');
  END IF;

  -- 4. Vérification du montant reçu vs montant attendu, au FCFA près.
  --    Écart → 'disputed', pas de reversement, à trancher par un admin.
  IF p_received_amount IS NOT NULL AND p_received_amount <> v_pi.montant_total THEN
    UPDATE payment_intents SET
      statut          = 'disputed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (p_payment_intent_id, 'disputed',
            jsonb_build_object('source', p_source, 'expected', v_pi.montant_total, 'received', p_received_amount));

    RETURN jsonb_build_object('ok', false, 'disputed', true, 'expected', v_pi.montant_total, 'received', p_received_amount);
  END IF;

  -- 6. Succès confirmé : transition + activation commande/réservation + payout_queue,
  --    le tout dans cette même transaction (atomicité garantie par Postgres)
  UPDATE payment_intents SET
    statut          = 'confirmed',
    external_status = p_external_status,
    external_ref    = COALESCE(p_external_ref, external_ref),
    confirmed_at    = now(),
    updated_at      = now()
  WHERE id = p_payment_intent_id;

  v_confirm := public.confirm_order_from_payment(p_payment_intent_id);

  RETURN jsonb_build_object('ok', true, 'statut', 'confirmed') || v_confirm;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
