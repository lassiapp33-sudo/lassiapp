-- ===========================================================================
-- LASSI — Section 3 : Système de paiement blindé (suite)
-- ---------------------------------------------------------------------------
-- 3.3 process-payouts (reversement automatique)
--     payout_queue_claim_batch : verrouille un lot de reversements 'queued'
--     avec FOR UPDATE SKIP LOCKED (anti-concurrence entre exécutions cron qui
--     se chevaucheraient), passe en 'processing' et renvoie toutes les infos
--     nécessaires (recalculées depuis payment_intents, jamais depuis une
--     valeur potentiellement modifiée côté payout_queue).
--     payout_queue_mark_paid / payout_queue_mark_failure : référencés par
--     l'Edge Function process-payouts après l'appel API Wave/OM. Backoff
--     exponentiel (2min, 10min, 1h, 6h) et max 5 tentatives avant
--     'failed' (alerte admin).
--
-- 3.4 process_refund(payment_intent_id, admin_id, reason)
--     Remboursement admin-only : idempotent (statut 'refunded' déjà atteint
--     → no-op), bloqué si 'disputed' (litige à trancher d'abord), plafonné à
--     montant_total (gross_amount), trace dans payment_logs (= payment_events)
--     et annule les reversements pas encore partis (payout_queue → 'cancelled').
-- ===========================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 1. payout_queue : colonnes de retry + statut 'cancelled' (remboursement
--    avant reversement effectif)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payout_queue
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.payout_queue DROP CONSTRAINT payout_queue_statut_check;
ALTER TABLE public.payout_queue ADD CONSTRAINT payout_queue_statut_check
  CHECK (statut IN ('queued', 'processing', 'paid', 'failed', 'cancelled'));


-- ───────────────────────────────────────────────────────────────────────────
-- 2. payout_queue_claim_batch — Section 3.3, étape 1
--    Sélectionne les payouts 'queued' prêts à être (re)tentés, les verrouille
--    avec FOR UPDATE SKIP LOCKED (deux exécutions cron concurrentes ne
--    traitent jamais la même ligne), les passe en 'processing' et renvoie
--    les montants/numéro recalculés depuis les sources de vérité
--    (payment_intents.prix_base/commission_lassi/montant_total, profiles.phone).
-- ───────────────────────────────────────────────────────────────────────────
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
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT pq.id
    FROM payout_queue pq
    WHERE pq.statut = 'queued'
      AND pq.next_attempt_at <= now()
    ORDER BY pq.created_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE payout_queue pq
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
  JOIN profiles pr        ON pr.id = u.prestataire_id
  JOIN payment_intents pi ON pi.id = u.payment_intent_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. payout_queue_mark_paid — Section 3.3, étape 5 (succès)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.payout_queue_mark_paid(
  p_payout_id    UUID,
  p_external_ref TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pq payout_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_pq FROM payout_queue WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payout_not_found');
  END IF;

  -- Idempotence : déjà marqué payé (retry réseau de l'Edge Function elle-même)
  IF v_pq.statut = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true);
  END IF;

  IF v_pq.statut <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state', 'statut', v_pq.statut);
  END IF;

  UPDATE payout_queue SET
    statut              = 'paid',
    external_payout_ref = p_external_ref,
    processed_at        = now(),
    updated_at          = now()
  WHERE id = p_payout_id;

  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    v_pq.payment_intent_id, 'payout_completed',
    jsonb_build_object('payout_id', p_payout_id, 'montant', v_pq.montant, 'external_ref', p_external_ref)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_mark_paid(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_queue_mark_paid(UUID, TEXT) TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. payout_queue_mark_failure — Section 3.3, étape 5 (échec) + backoff
--    p_terminal = TRUE pour les échecs définitifs sans retry (numéro
--    invalide, incohérence de montant détectée → "JAMAIS si doute").
--    Backoff : tentative 1 → +2min, 2 → +10min, 3 → +1h, 4 → +6h,
--    5 → 'failed' définitif (alerte admin).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.payout_queue_mark_failure(
  p_payout_id UUID,
  p_error     TEXT,
  p_terminal  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pq              payout_queue%ROWTYPE;
  v_new_attempts    INTEGER;
  v_backoff_minutes INTEGER;
  v_terminal        BOOLEAN;
BEGIN
  SELECT * INTO v_pq FROM payout_queue WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payout_not_found');
  END IF;

  -- Idempotence : déjà dans un état terminal, ne rien refaire
  IF v_pq.statut IN ('paid', 'cancelled', 'failed') THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true, 'statut', v_pq.statut);
  END IF;

  v_new_attempts := v_pq.attempts + 1;
  v_terminal     := p_terminal OR v_new_attempts >= 5;

  IF v_terminal THEN
    UPDATE payout_queue SET
      statut     = 'failed',
      attempts   = v_new_attempts,
      last_error = p_error,
      updated_at = now()
    WHERE id = p_payout_id;

    -- ALERTE ADMIN : reversement bloqué définitivement, intervention manuelle requise
    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
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

  UPDATE payout_queue SET
    statut          = 'queued',
    attempts        = v_new_attempts,
    next_attempt_at = now() + (v_backoff_minutes || ' minutes')::interval,
    last_error      = p_error,
    updated_at      = now()
  WHERE id = p_payout_id;

  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    v_pq.payment_intent_id, 'payout_retry',
    jsonb_build_object('payout_id', p_payout_id, 'attempts', v_new_attempts, 'error', p_error, 'next_attempt_in_minutes', v_backoff_minutes)
  );

  RETURN jsonb_build_object('ok', true, 'statut', 'queued', 'attempts', v_new_attempts, 'next_attempt_in_minutes', v_backoff_minutes);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_mark_failure(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_queue_mark_failure(UUID, TEXT, BOOLEAN) TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. process_refund — Section 3.4
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_refund(
  p_payment_intent_id UUID,
  p_admin_id          UUID,
  p_reason            TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pi payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_pi FROM payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotence stricte : un remboursement ne peut être déclenché 2 fois
  IF v_pi.statut = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true, 'refunded_amount', v_pi.montant_total);
  END IF;

  -- Bloqué si litige en cours : à trancher avant tout remboursement
  IF v_pi.statut = 'disputed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'disputed');
  END IF;

  -- On ne rembourse que ce qui a réellement été encaissé
  IF v_pi.statut NOT IN ('confirmed', 'split_done', 'simulated') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'statut', v_pi.statut);
  END IF;

  -- Plafond : remboursement intégral uniquement, jamais plus que
  -- montant_total (gross_amount) — invariant garanti par construction ici
  -- car aucun montant n'est pris en paramètre.
  UPDATE payment_intents SET
    statut     = 'refunded',
    updated_at = now()
  WHERE id = p_payment_intent_id;

  -- Annuler les reversements prestataire pas encore partis
  UPDATE payout_queue SET
    statut     = 'cancelled',
    updated_at = now()
  WHERE payment_intent_id = p_payment_intent_id
    AND statut IN ('queued', 'processing');

  -- Si le reversement était déjà effectué : alerte pour récupération manuelle
  IF EXISTS (
    SELECT 1 FROM payout_queue
    WHERE payment_intent_id = p_payment_intent_id AND statut = 'paid'
  ) THEN
    INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id, 'refund_after_payout',
      jsonb_build_object('admin_id', p_admin_id, 'reason', p_reason, 'alert', true)
    );
  END IF;

  INSERT INTO payment_logs (payment_intent_id, event_type, event_data)
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
GRANT EXECUTE ON FUNCTION public.process_refund(UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
