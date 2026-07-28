-- ===========================================================================
-- LASSI — Fix horaires cron "À la une" : 10h + 20h UTC (= 10h + 20h Dakar)
-- Migration 2026-07-27
-- ---------------------------------------------------------------------------
-- Senegal = UTC+0 (GMT toute l'année).
-- La migration précédente planifiait à 13h UTC (= 13h Dakar) → corrigé en 10h.
-- Les tâches sont renommées pour refléter les vraies heures.
-- ===========================================================================

-- ─── 1. Supprimer toutes les anciennes tâches ─────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-13h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-10h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('lassi-notify-alaune-20h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── 2. Cron 10h00 UTC (= 10h Dakar) ─────────────────────────────────────────
DO $cron1$
BEGIN
  PERFORM cron.schedule(
    'lassi-notify-alaune-10h',
    '0 10 * * *',
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
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-10h planifiée (10h00 UTC = 10h Dakar)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron1$;

-- ─── 3. Cron 20h00 UTC (= 20h Dakar) ─────────────────────────────────────────
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
  RAISE NOTICE 'pg_cron : tâche lassi-notify-alaune-20h planifiée (20h00 UTC = 20h Dakar)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement', SQLERRM;
END $cron2$;

-- ─── 4. Vérification : afficher les tâches actives ───────────────────────────
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'lassi-notify-alaune-%';
