-- FIX paiement — process_payment_webhook ne doit PAS marquer 'failed' sur un
-- statut Wave/OM NON terminal (ex: 'processing', 'pending'). Avant ce fix, tout
-- événement webhook avec p_is_success=false tuait le payment_intent en 'failed'
-- de façon définitive. Wave envoie un event intermédiaire payment_status='processing'
-- AVANT le 'completed' : le PI était empoisonné → le 'completed' suivant tombait
-- dans la branche "not_pending" (ignoré) → commande bloquée 'pending', affichée
-- FAILED, et un client qui finissait de payer lentement était débité sans commande.
--
-- Nouveau comportement :
--   * succès                          → confirmed (inchangé)
--   * échec TERMINAL (expired/cancel/
--     failed/error/declined/refused)  → failed (inchangé)
--   * non-succès NON terminal
--     (processing/pending/inconnu/'') → NE RIEN CHANGER (reste initiated/pending),
--                                        log 'webhook_pending'. Le 'completed' ou
--                                        le cron reconcile tranchera ensuite.
--
-- Idempotence, déduplication, contrôle de montant : INCHANGÉS.

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_external_event_id text,
  p_payment_intent_id uuid,
  p_source text,
  p_external_status text,
  p_external_ref text,
  p_received_amount integer,
  p_is_success boolean,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pi                 public.payment_intents%ROWTYPE;
  v_log_id             UUID;
  v_confirm            JSONB;
  v_already_processed  BOOLEAN := FALSE;
  v_status_norm        TEXT := lower(trim(coalesce(p_external_status, '')));
  v_is_terminal_fail   BOOLEAN;
BEGIN
  -- Statuts d'ÉCHEC TERMINAUX uniquement. Tout le reste de non-succès
  -- (processing, pending, created, vide, inconnu) est considéré NON terminal.
  v_is_terminal_fail := v_status_norm IN (
    'expired', 'failed', 'cancelled', 'canceled', 'error',
    'payment_failed', 'declined', 'refused', 'rejected', 'aborted'
  );

  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

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

  -- ── Non-succès ────────────────────────────────────────────────────────────
  IF NOT p_is_success THEN
    -- NON terminal (processing/pending/inconnu) : ne rien changer, juste tracer.
    IF NOT v_is_terminal_fail THEN
      INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
      VALUES (
        p_payment_intent_id,
        'webhook_pending',
        jsonb_build_object('source', p_source, 'external_status', p_external_status)
      );
      RETURN jsonb_build_object('ok', true, 'statut', v_pi.statut, 'pending', true);
    END IF;

    -- Échec TERMINAL : marquer failed.
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

  -- Tolérance 1 FCFA (arrondi Wave/OM côté FCFA)
  IF p_received_amount IS NOT NULL AND ABS(p_received_amount - v_pi.montant_total) > 1 THEN
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
$function$;
