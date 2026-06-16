-- ─── Planification du nettoyage des abonnements "Offre du Quartier" expirés ──
-- expire_visibility_subscriptions() (definie dans 20260610030000_offre_quartier.sql)
-- n'etait jamais planifiee via pg_cron : visibility_subscriptions.status restait
-- 'active' et shops.is_featured restait TRUE indefiniment apres expiration,
-- bloquant tout nouvel achat (create-credit-purchase / create-visibility-payment)
-- via idx_vissub_shop_active_unique avec un message "Un abonnement actif existe
-- deja" trompeur, et offrant la mise en avant gratuitement a vie au marchand.

DO $$ BEGIN
  PERFORM cron.unschedule('expire-visibility');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Le bloc schedule ne doit PAS avaler les exceptions : si pg_cron n'est pas
-- installé ou si le schedule échoue, la migration doit échouer visiblement
-- pour que l'opérateur soit prévenu (sinon les abonnements expirés restent
-- actifs à vie et bloquent tout nouvel achat).
SELECT cron.schedule(
  'expire-visibility',
  '0 1 * * *',  -- tous les jours a 1h00
  'SELECT public.expire_visibility_subscriptions()'
);
