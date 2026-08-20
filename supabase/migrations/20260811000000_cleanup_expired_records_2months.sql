-- ============================================================
-- LASSI — Nettoyage automatique des enregistrements expirés
-- Règle : suppression définitive 2 mois après expiration individuelle
--   • fitness_abonnements_clients : 2 mois après date_expiration
--   • table_reservations          : 2 mois après date_reservation
--   • beauty_appointments         : 2 mois après date_rdv
-- Fréquence : chaque nuit à 03h00 UTC (pg_cron)
-- ============================================================

-- ─── Fonction de nettoyage ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lassi_cleanup_expired_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Abonnements fitness expirés depuis plus de 2 mois
  DELETE FROM fitness_abonnements_clients
  WHERE statut = 'expire'
    AND date_expiration < NOW() - INTERVAL '2 months';

  -- Réservations de table dont la date est passée depuis plus de 2 mois
  DELETE FROM table_reservations
  WHERE date_reservation < CURRENT_DATE - INTERVAL '2 months';

  -- Rendez-vous beauté dont la date est passée depuis plus de 2 mois
  DELETE FROM beauty_appointments
  WHERE date_rdv < CURRENT_DATE - INTERVAL '2 months';
END;
$$;

REVOKE ALL ON FUNCTION lassi_cleanup_expired_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lassi_cleanup_expired_records() TO postgres;

-- ─── Planification pg_cron (chaque nuit à 03h00 UTC) ─────────────────────────

SELECT cron.schedule(
  'lassi-cleanup-expired-records',
  '0 3 * * *',
  'SELECT lassi_cleanup_expired_records();'
);
