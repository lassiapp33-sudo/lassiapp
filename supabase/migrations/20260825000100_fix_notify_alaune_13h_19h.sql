-- ===========================================================================
-- LASSI — Fix horaires cron "À la une" : 13h + 19h UTC (= 13h + 19h Dakar)
-- Migration 2026-08-25
-- ---------------------------------------------------------------------------
-- Senegal = UTC+0 (GMT toute l'année).
-- Anciens horaires : 10h + 20h → nouveaux : 13h + 19h.
-- ===========================================================================

-- ─── 1. Supprimer les anciennes tâches ───────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-10h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-20h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-13h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-19h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── 2. Cron 13h00 UTC (= 13h Dakar) ────────────────────────────────────────
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
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-13h planifiée (13h00 UTC = 13h Dakar)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron1$;

-- ─── 3. Cron 19h00 UTC (= 19h Dakar) ────────────────────────────────────────
DO $cron2$
BEGIN
  PERFORM cron.schedule(
    'lassi-notify-alaune-19h',
    '0 19 * * *',
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
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-19h planifiée (19h00 UTC = 19h Dakar)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron2$;

-- ─── 4. Vérification ─────────────────────────────────────────────────────────
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'lassi-notify-alaune-%';
