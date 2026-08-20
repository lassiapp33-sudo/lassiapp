-- ===========================================================================
-- BLINDAGE PAYOUT : résilience cron + watchdog + vault
-- ---------------------------------------------------------------------------
-- Problèmes corrigés dans cette session (10 août 2026) :
--
--   1. initiate_order_payment acceptait uniquement status='new' → toutes les
--      commandes Wave/OM (status='pending' depuis 20260808020000) bloquées.
--      → Corrigé dans 20260810000000
--
--   2. CRON_SECRET absent du Vault Supabase → le cron envoyait X-Cron-Secret=null
--      → process-payouts retournait 401 sans toucher payout_queue → payout
--      reste à jamais en statut 'queued' avec attempts=0.
--      → Corrigé : cron reschedule avec secret hardcodé + vault.create_secret ci-dessous
--
-- RÈGLES IMMUABLES À NE JAMAIS BRISER (voir aussi memory/project_om_payment_flow.md) :
--   - confirm_order_from_payment doit TOUJOURS insérer dans payout_queue
--   - initiate_order_payment doit accepter status IN ('new', 'pending')
--   - CRON_SECRET doit être dans les EF secrets ET dans le cron SQL
-- ===========================================================================


-- ─── 1. Créer le secret Vault s'il n'existe pas ───────────────────────────────
-- (S'il existe déjà, cette instruction est ignorée par ON CONFLICT)
-- Le secret est aussi hardcodé dans le cron via cron.unschedule/schedule ci-dessous.
DO $$
BEGIN
  PERFORM vault.create_secret(
    current_setting('app.cron_secret', true),
    'lassi_process_payouts_cron_secret',
    'X-Cron-Secret pour appeler process-payouts depuis pg_cron'
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Secret déjà créé → OK
    RAISE NOTICE 'Vault secret lassi_process_payouts_cron_secret déjà présent';
  WHEN OTHERS THEN
    RAISE NOTICE 'Vault secret non créé (%) — le cron utilise le secret hardcodé', SQLERRM;
END;
$$;


-- ─── 2. Fonction watchdog : alerter si un payout reste bloqué > 15 min ───────
-- Appelée par process-payouts ET par un cron séparé (toutes les 15 min).
-- Insère dans payment_logs event_type='payout_stuck_alert' pour visibilité admin.
CREATE OR REPLACE FUNCTION public.check_stuck_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Payouts bloqués : queued depuis > 15 min avec next_attempt_at dépassé
  -- (= jamais tenté ou retry bloqué)
  SELECT COUNT(*) INTO v_count
  FROM public.payout_queue
  WHERE statut = 'queued'
    AND created_at < NOW() - INTERVAL '15 minutes'
    AND next_attempt_at < NOW() - INTERVAL '5 minutes';

  IF v_count > 0 THEN
    -- Alerte dans payment_logs (visible dans le dashboard admin)
    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    SELECT
      pq.payment_intent_id,
      'payout_stuck_alert',
      jsonb_build_object(
        'payout_id',       pq.id,
        'statut',          pq.statut,
        'montant',         pq.montant,
        'attempts',        pq.attempts,
        'last_error',      pq.last_error,
        'created_at',      pq.created_at,
        'minutes_bloque',  EXTRACT(EPOCH FROM (NOW() - pq.created_at)) / 60,
        'alert',           true
      )
    FROM public.payout_queue pq
    WHERE pq.statut = 'queued'
      AND pq.created_at < NOW() - INTERVAL '15 minutes'
      AND pq.next_attempt_at < NOW() - INTERVAL '5 minutes';
  END IF;

  RETURN jsonb_build_object('ok', true, 'stuck_count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_stuck_payouts() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_stuck_payouts() TO service_role;


-- ─── 3. Cron watchdog : toutes les 15 min ──────────────────────────────────────
DO $cron$ BEGIN
  PERFORM cron.unschedule('lassi-payout-watchdog');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron$;

DO $cron2$ BEGIN
  PERFORM cron.schedule(
    'lassi-payout-watchdog',
    '*/15 * * * *',
    $sql$
    SELECT public.check_stuck_payouts();
    $sql$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron watchdog non planifié (%) — activer pg_cron via Dashboard > Extensions', SQLERRM;
END $cron2$;


-- ─── 4. Validation post-migration ────────────────────────────────────────────
-- Vérifie que confirm_order_from_payment insère bien dans payout_queue
DO $$
DECLARE
  v_body TEXT;
BEGIN
  SELECT prosrc INTO v_body
  FROM pg_proc
  WHERE proname = 'confirm_order_from_payment'
    AND pronamespace = 'public'::regnamespace;

  IF v_body IS NULL THEN
    RAISE EXCEPTION '[lassi] confirm_order_from_payment introuvable !';
  END IF;

  IF v_body NOT LIKE '%payout_queue%' THEN
    RAISE EXCEPTION '[lassi] DANGER : confirm_order_from_payment ne contient pas INSERT payout_queue ! Régression détectée.';
  END IF;

  IF v_body NOT LIKE '%split_done%' THEN
    RAISE EXCEPTION '[lassi] DANGER : confirm_order_from_payment ne passe pas en split_done ! Régression détectée.';
  END IF;

  RAISE NOTICE '[lassi] confirm_order_from_payment OK — payout_queue et split_done présents';
END;
$$;


-- ─── 5. Réconciliation immédiate : débloquer les payouts stuck ────────────────
DO $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT public.reconcile_missing_payouts() INTO v_result;
  RAISE NOTICE '[lassi] reconcile_missing_payouts: %', v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
