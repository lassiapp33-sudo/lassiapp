-- ===========================================================================
-- LASSI — Section 3.3 : planification automatique de process-payouts
-- ---------------------------------------------------------------------------
-- pg_cron (toutes les 2 minutes) + pg_net (appel HTTP) déclenchent l'Edge
-- Function process-payouts. Le secret partagé (X-Cron-Secret, déjà configuré
-- via `supabase secrets set CRON_SECRET=...`) est lu depuis Supabase Vault —
-- il n'apparaît JAMAIS dans une migration versionnée.
--
-- ⚠️ PRÉREQUIS — à exécuter UNE SEULE FOIS dans Supabase Dashboard >
-- SQL Editor (PAS dans une migration, pour ne jamais committer le secret) :
--
--   select vault.create_secret(
--     'VALEUR_DE_VOTRE_CRON_SECRET',
--     'lassi_process_payouts_cron_secret',
--     'X-Cron-Secret pour appeler process-payouts depuis pg_cron'
--   );
--
-- Pour changer la valeur plus tard :
--   update vault.secrets set secret = 'NOUVELLE_VALEUR'
--   where name = 'lassi_process_payouts_cron_secret';
-- ===========================================================================

-- ─── 1. Activer pg_cron / pg_net si pas déjà fait ────────────────────────────
-- Ne bloque pas si déjà actif ou si le rôle n'a pas les droits (dans ce cas,
-- activer via Dashboard > Database > Extensions).
DO $$ BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron non activé automatiquement (%) — activer via Dashboard > Database > Extensions', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net non activé automatiquement (%) — activer via Dashboard > Database > Extensions', SQLERRM;
END $$;

-- ─── 2. Planifier process-payouts toutes les 2 minutes ───────────────────────
DO $cron1$
BEGIN
  PERFORM cron.unschedule('lassi-process-payouts');
EXCEPTION WHEN OTHERS THEN
  NULL; -- tâche inexistante au premier déploiement
END $cron1$;

DO $cron2$
BEGIN
  PERFORM cron.schedule(
    'lassi-process-payouts',
    '*/2 * * * *',
    $sql$
    SELECT net.http_post(
      url     := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/process-payouts',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                           WHERE name = 'lassi_process_payouts_cron_secret')
      ),
      body := '{}'::jsonb
    );
    $sql$
  );
  RAISE NOTICE 'pg_cron : tâche lassi-process-payouts planifiée (toutes les 2 minutes)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net non disponible (%) — planifier manuellement une fois actifs', SQLERRM;
END $cron2$;
