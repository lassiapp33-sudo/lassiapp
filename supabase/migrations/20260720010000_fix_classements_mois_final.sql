-- ===========================================================================
-- Fix : il manquait un pg_cron le 1er du mois à 00h05 UTC pour faire le
-- recalcul FINAL du mois précédent avant que les récompenses soient
-- attribuées à 00h10 par classements-mensuel.yml.
--
-- Sans ce job, la dernière photo du classement mensuel est celle du dernier
-- dimanche du mois → les 3-4 derniers jours du mois ne comptent pas pour
-- les récompenses (ex: juillet 28-31 absents si dernier dim. = 27 juil.).
-- ===========================================================================

-- ─── 1. Supprimer l'ancien job s'il existait (relance idempotente) ───────────

DO $cron_drop$
BEGIN
  PERFORM cron.unschedule('lassi-classements-mois-final');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron_drop$;

-- ─── 2. Créer le job : 1er du mois 00h05 UTC → recalcul mois précédent ──────
--
-- À 00h05 le 1er août : NOW() = 2026-08-01 → NOW() - 1 day = 2026-07-31
-- TO_CHAR('2026-07-31', 'YYYY-MM') = '2026-07'
-- Fenêtre : 2026-07-01 00:00 UTC → 2026-08-01 00:00 UTC (tous les jours) ✓
-- 5 min avant classements-mensuel.yml (00h10) → snapshot complet disponible

DO $cron_add$
BEGIN
  PERFORM cron.schedule(
    'lassi-classements-mois-final',
    '5 0 1 * *',
    $sql$
      SET statement_timeout = '300000';
      SELECT calcul_classements_mois(
        TO_CHAR((NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day', 'YYYY-MM')
      );
    $sql$
  );
  RAISE NOTICE 'CRON lassi-classements-mois-final planifié (1er du mois 00h05 UTC)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponible : %', SQLERRM;
END $cron_add$;

NOTIFY pgrst, 'reload schema';
