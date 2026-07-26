-- ===========================================================================
-- LASSI — Notifications "À la une" quotidiennes (13h + 20h UTC)
-- Migration 2026-07-22
-- ---------------------------------------------------------------------------
-- pg_cron appelle notify-alaune-cron via pg_net à 13h00 et 20h00 UTC.
-- La fonction vérifie qu'au moins 1 bloc "À la une" est actif avant d'envoyer.
-- Utilise le même CRON_SECRET que process-payouts (vault : lassi_process_payouts_cron_secret).
-- ===========================================================================

-- ─── 1. Supprimer les tâches existantes si elles existent ────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('lassi-notify-alaune-13h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('lassi-notify-alaune-20h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 2. Planifier à 13h00 UTC ────────────────────────────────────────────────
DO $cron1$
BEGIN
  PERFORM cron.schedule(
    'lassi-notify-alaune-13h',
    '0 13 * * *',
    $sql$
    SELECT net.http_post(
      url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/notify-alaune-cron',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                           WHERE name = 'lassi_process_payouts_cron_secret')
      ),
      body := '{}'::jsonb
    );
    $sql$
  );
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-13h planifiée (13h00 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron1$;

-- ─── 3. Planifier à 20h00 UTC ────────────────────────────────────────────────
DO $cron2$
BEGIN
  PERFORM cron.schedule(
    'lassi-notify-alaune-20h',
    '0 20 * * *',
    $sql$
    SELECT net.http_post(
      url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/notify-alaune-cron',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                           WHERE name = 'lassi_process_payouts_cron_secret')
      ),
      body := '{}'::jsonb
    );
    $sql$
  );
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-20h planifiée (20h00 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron2$;
