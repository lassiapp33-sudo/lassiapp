-- ============================================================
-- LASSI · Déclenchement auto de l'attribution des récompenses mondiales · Phase 5 (bis)
-- ============================================================
-- Appelle l'Edge Function attribuer-recompenses-mondial (Phase 4) via pg_net,
-- 5 minutes après calculer_classement_mondial (cron `classement-mensuel`),
-- pour laisser le temps au classement `mondial` d'être écrit.
--
-- Prérequis manuel, une seule fois, dans le SQL editor Supabase (le secret
-- n'est jamais écrit dans une migration) :
--   select vault.create_secret('<valeur de CRON_SECRET>', 'cron_secret');
--
-- Si le secret 'cron_secret' n'existe pas, cet appel échoue silencieusement
-- (le calcul du classement mondial lui-même n'est pas affecté) — il faudra
-- alors déclencher attribuer-recompenses-mondial manuellement (JWT admin).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'classement-mensuel-recompenses',
  '5 0 1 * *',  -- 1er du mois à 00h05
  $$
    SELECT net.http_post(
      url := 'https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/attribuer-recompenses-mondial',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'
        )
      ),
      body := jsonb_build_object('periode', to_char(now() - interval '1 day', 'YYYY-MM'))
    );
  $$
);
