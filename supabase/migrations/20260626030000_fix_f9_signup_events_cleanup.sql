-- ===========================================================================
-- LASSI — F9 : Nettoyage automatique de signup_events
-- ---------------------------------------------------------------------------
-- La table signup_events stocke les IPs pour le rate-limiting des inscriptions
-- (1 heure de fenêtre). Sans nettoyage, elle grossit indéfiniment.
-- Job pg_cron toutes les 6h : supprime les entrées > 24h.
-- ===========================================================================

DO $cron_signup$
BEGIN
  PERFORM cron.unschedule('cleanup-signup-events');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron_signup$;

DO $cron_signup2$
BEGIN
  PERFORM cron.schedule(
    'cleanup-signup-events',
    '0 */6 * * *',
    $sql$
      DELETE FROM public.signup_events
      WHERE created_at < now() - INTERVAL '24 hours';
    $sql$
  );
  RAISE NOTICE 'pg_cron cleanup-signup-events planifié (toutes les 6h)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron non disponible (%) — planifier manuellement', SQLERRM;
END $cron_signup2$;
