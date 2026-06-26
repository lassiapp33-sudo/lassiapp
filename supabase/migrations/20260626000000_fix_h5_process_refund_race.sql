-- ===========================================================================
-- SÉCURITÉ H5 : Race condition process_refund / payout en vol
-- ---------------------------------------------------------------------------
-- Problème : process_refund annulait les payouts en statut 'processing',
-- or 'processing' signifie que payout_queue_claim_batch a déjà verrouillé
-- la ligne et que process-payouts est en train d'appeler Wave/OM.
-- L'argent peut avoir déjà quitté le compte LASSI avant que le statut
-- soit changé en 'cancelled'.
--
-- Corrections :
--   1. process_refund n'annule que 'queued' (pas encore démarrés).
--      Pour 'processing', on logue une alerte — l'Edge Function détectera
--      l'état lors du payout_queue_mark_paid et loggera à son tour.
--
--   2. payout_queue_mark_paid détecte 'cancelled' et crée un log
--      'payout_sent_after_cancel' au lieu de retourner silencieusement
--      invalid_state.
--
--   3. search_path = '' sur toutes les fonctions payout (protection
--      contre l'injection via pg_temp).
-- ===========================================================================


-- ─── 1. process_refund : ne plus annuler les payouts 'processing' ────────────

CREATE OR REPLACE FUNCTION public.process_refund(
  p_payment_intent_id UUID,
  p_admin_id          UUID,
  p_reason            TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  IF v_pi.statut = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true, 'refunded_amount', v_pi.montant_total);
  END IF;

  IF v_pi.statut = 'disputed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'disputed');
  END IF;

  IF v_pi.statut NOT IN ('confirmed', 'split_done', 'simulated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'statut', v_pi.statut);
  END IF;

  UPDATE public.payment_intents SET
    statut     = 'refunded',
    updated_at = now()
  WHERE id = p_payment_intent_id;

  -- Annuler uniquement les payouts 'queued' (pas encore démarrés).
  -- 'processing' = payout potentiellement en vol → on ne touche pas.
  UPDATE public.payout_queue SET
    statut     = 'cancelled',
    updated_at = now()
  WHERE payment_intent_id = p_payment_intent_id
    AND statut = 'queued';

  -- Si des payouts sont en 'processing', logger une alerte.
  -- L'Edge Function process-payouts appellera payout_queue_mark_paid qui
  -- détectera le statut et créera un log 'payout_sent_after_cancel'.
  IF EXISTS (
    SELECT 1 FROM public.payout_queue
    WHERE payment_intent_id = p_payment_intent_id AND statut = 'processing'
  ) THEN
    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id, 'refund_with_processing_payout',
      jsonb_build_object(
        'admin_id', p_admin_id,
        'reason',   p_reason,
        'alert',    true,
        'message',  'Payout en cours (processing) lors du remboursement — vérification manuelle requise si argent envoyé'
      )
    );
  END IF;

  -- Alerte si reversement déjà effectué (statut 'paid')
  IF EXISTS (
    SELECT 1 FROM public.payout_queue
    WHERE payment_intent_id = p_payment_intent_id AND statut = 'paid'
  ) THEN
    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id, 'refund_after_payout',
      jsonb_build_object('admin_id', p_admin_id, 'reason', p_reason, 'alert', true)
    );
  END IF;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    p_payment_intent_id, 'refunded',
    jsonb_build_object('admin_id', p_admin_id, 'reason', p_reason, 'amount', v_pi.montant_total)
  );

  RETURN jsonb_build_object(
    'ok',              true,
    'refunded_amount', v_pi.montant_total,
    'order_id',        v_pi.order_id,
    'reservation_id',  v_pi.reservation_id,
    'client_id',       v_pi.client_id,
    'moyen_paiement',  v_pi.moyen_paiement,
    'external_ref',    v_pi.external_ref
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_refund(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_refund(UUID, UUID, TEXT) TO service_role;


-- ─── 2. payout_queue_mark_paid : détection payout_sent_after_cancel ──────────

CREATE OR REPLACE FUNCTION public.payout_queue_mark_paid(
  p_payout_id    UUID,
  p_external_ref TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pq public.payout_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_pq FROM public.payout_queue WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payout_not_found');
  END IF;

  -- Idempotence : déjà payé (retry réseau de l'Edge Function)
  IF v_pq.statut = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true);
  END IF;

  -- Race condition détectée : payout annulé alors que l'argent était déjà parti
  IF v_pq.statut = 'cancelled' THEN
    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      v_pq.payment_intent_id, 'payout_sent_after_cancel',
      jsonb_build_object(
        'payout_id',    p_payout_id,
        'montant',      v_pq.montant,
        'external_ref', p_external_ref,
        'alert',        true,
        'message',      'Payout envoyé au fournisseur après annulation DB (race condition) — récupération manuelle requise'
      )
    );
    RETURN jsonb_build_object('ok', false, 'error', 'payout_sent_after_cancel', 'statut', 'cancelled');
  END IF;

  IF v_pq.statut <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state', 'statut', v_pq.statut);
  END IF;

  UPDATE public.payout_queue SET
    statut              = 'paid',
    external_payout_ref = p_external_ref,
    processed_at        = now(),
    updated_at          = now()
  WHERE id = p_payout_id;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    v_pq.payment_intent_id, 'payout_completed',
    jsonb_build_object('payout_id', p_payout_id, 'montant', v_pq.montant, 'external_ref', p_external_ref)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_mark_paid(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.payout_queue_mark_paid(UUID, TEXT) TO service_role;


-- ─── 3. payout_queue_claim_batch : search_path = '' ─────────────────────────

CREATE OR REPLACE FUNCTION public.payout_queue_claim_batch(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id                     UUID,
  payment_intent_id      UUID,
  prestataire_id         UUID,
  montant                INTEGER,
  attempts               INTEGER,
  prestataire_phone      TEXT,
  moyen_paiement         TEXT,
  prix_base              INTEGER,
  commission_lassi       INTEGER,
  montant_total          INTEGER,
  payment_intent_statut  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT pq.id
    FROM public.payout_queue pq
    WHERE pq.statut = 'queued'
      AND pq.next_attempt_at <= now()
    ORDER BY pq.created_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.payout_queue pq
    SET statut = 'processing', updated_at = now()
    FROM claimed
    WHERE pq.id = claimed.id
    RETURNING pq.id, pq.payment_intent_id, pq.prestataire_id, pq.montant, pq.attempts
  )
  SELECT
    u.id, u.payment_intent_id, u.prestataire_id, u.montant, u.attempts,
    pr.phone,
    pi.moyen_paiement, pi.prix_base, pi.commission_lassi, pi.montant_total, pi.statut
  FROM updated u
  JOIN public.profiles pr        ON pr.id = u.prestataire_id
  JOIN public.payment_intents pi ON pi.id = u.payment_intent_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) TO service_role;


-- ─── 4. payout_queue_mark_failure : search_path = '' ────────────────────────

CREATE OR REPLACE FUNCTION public.payout_queue_mark_failure(
  p_payout_id UUID,
  p_error     TEXT,
  p_terminal  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pq              public.payout_queue%ROWTYPE;
  v_new_attempts    INTEGER;
  v_backoff_minutes INTEGER;
  v_terminal        BOOLEAN;
BEGIN
  SELECT * INTO v_pq FROM public.payout_queue WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payout_not_found');
  END IF;

  IF v_pq.statut IN ('paid', 'cancelled', 'failed') THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true, 'statut', v_pq.statut);
  END IF;

  v_new_attempts := v_pq.attempts + 1;
  v_terminal     := p_terminal OR v_new_attempts >= 5;

  IF v_terminal THEN
    UPDATE public.payout_queue SET
      statut     = 'failed',
      attempts   = v_new_attempts,
      last_error = p_error,
      updated_at = now()
    WHERE id = p_payout_id;

    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      v_pq.payment_intent_id, 'payout_failed',
      jsonb_build_object('payout_id', p_payout_id, 'attempts', v_new_attempts, 'error', p_error, 'alert', true)
    );

    RETURN jsonb_build_object('ok', true, 'statut', 'failed', 'attempts', v_new_attempts);
  END IF;

  v_backoff_minutes := CASE v_new_attempts
    WHEN 1 THEN 2
    WHEN 2 THEN 10
    WHEN 3 THEN 60
    ELSE 360
  END;

  UPDATE public.payout_queue SET
    statut          = 'queued',
    attempts        = v_new_attempts,
    next_attempt_at = now() + (v_backoff_minutes || ' minutes')::interval,
    last_error      = p_error,
    updated_at      = now()
  WHERE id = p_payout_id;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    v_pq.payment_intent_id, 'payout_retry',
    jsonb_build_object('payout_id', p_payout_id, 'attempts', v_new_attempts, 'error', p_error, 'next_attempt_in_minutes', v_backoff_minutes)
  );

  RETURN jsonb_build_object('ok', true, 'statut', 'queued', 'attempts', v_new_attempts, 'next_attempt_in_minutes', v_backoff_minutes);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_mark_failure(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.payout_queue_mark_failure(UUID, TEXT, BOOLEAN) TO service_role;
