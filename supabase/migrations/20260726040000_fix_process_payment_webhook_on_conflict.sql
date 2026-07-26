-- ===========================================================================
-- FIX CRITIQUE : process_payment_webhook — incompatibilité ON CONFLICT + RULE
-- ---------------------------------------------------------------------------
-- payment_logs a des RULES PostgreSQL (no_update, no_delete) pour être
-- append-only. PostgreSQL interdit INSERT...ON CONFLICT sur une table avec
-- des RULES, même si la RULE ne concerne que UPDATE/DELETE.
-- Erreur : "INSERT with ON CONFLICT clause cannot be used with table that
--           has INSERT or UPDATE rules"
--
-- Solution : remplacer le ON CONFLICT par un bloc EXCEPTION unique_violation.
-- L'idempotence est préservée : si external_event_id existe déjà, la violation
-- de contrainte unique est capturée et on retourne already_processed=true.
-- ===========================================================================

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
SET search_path = ''
AS $$
DECLARE
  v_pi                 public.payment_intents%ROWTYPE;
  v_log_id             UUID;
  v_confirm            JSONB;
  v_already_processed  BOOLEAN := FALSE;
BEGIN
  -- Recharger + verrouiller le payment_intent
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  -- Idempotence : capturer la violation unique plutôt que ON CONFLICT
  -- (ON CONFLICT interdit sur payment_logs qui a des RULES PostgreSQL)
  BEGIN
    INSERT INTO public.payment_logs
      (payment_intent_id, event_type, event_data, external_event_id)
    VALUES (
      p_payment_intent_id,
      'webhook_received',
      jsonb_build_object(
        'source', p_source,
        'status', p_external_status,
        'payload', p_raw_payload
      ),
      p_external_event_id
    )
    RETURNING id INTO v_log_id;
  EXCEPTION WHEN unique_violation THEN
    v_already_processed := TRUE;
  END;

  IF v_already_processed OR v_log_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- Anti-rejeu : ne traiter que les paiements encore en attente
  IF v_pi.statut NOT IN ('pending', 'initiated') THEN
    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id,
      'webhook_ignored',
      jsonb_build_object(
        'reason', 'not_pending',
        'statut', v_pi.statut,
        'source', p_source
      )
    );
    RETURN jsonb_build_object(
      'ok', true, 'ignored', true,
      'reason', 'not_pending', 'statut', v_pi.statut
    );
  END IF;

  -- Échec côté fournisseur
  IF NOT p_is_success THEN
    UPDATE public.payment_intents SET
      statut          = 'failed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id,
      'failed',
      jsonb_build_object('source', p_source, 'external_status', p_external_status)
    );

    RETURN jsonb_build_object('ok', true, 'statut', 'failed');
  END IF;

  -- Vérification montant reçu vs attendu
  IF p_received_amount IS NOT NULL AND p_received_amount <> v_pi.montant_total THEN
    UPDATE public.payment_intents SET
      statut          = 'disputed',
      external_status = p_external_status,
      external_ref    = COALESCE(p_external_ref, external_ref),
      updated_at      = now()
    WHERE id = p_payment_intent_id;

    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      p_payment_intent_id,
      'disputed',
      jsonb_build_object(
        'source', p_source,
        'expected', v_pi.montant_total,
        'received', p_received_amount
      )
    );

    RETURN jsonb_build_object(
      'ok', false, 'disputed', true,
      'expected', v_pi.montant_total,
      'received', p_received_amount
    );
  END IF;

  -- Succès confirmé : transition + activation commande + payout_queue
  UPDATE public.payment_intents SET
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

REVOKE EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB)
  TO service_role;

NOTIFY pgrst, 'reload schema';
