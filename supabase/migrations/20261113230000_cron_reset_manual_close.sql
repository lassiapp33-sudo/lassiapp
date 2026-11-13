-- ============================================================
-- LASSI · Auto-reset "Exceptionnellement fermé" · Migration 2026-11-13
-- ============================================================
-- Le toggle "Exceptionnellement fermé" (shops.is_manually_closed) n'avait
-- aucun reset : les marchands l'activaient une fois et restaient fermés
-- indéfiniment, malgré le libellé "jusqu'à demain matin".
-- Ce cron repasse le flag à false chaque matin → le statut redevient piloté
-- par les horaires (opening_hours), comme promis par le libellé.
-- Dakar = UTC+0 toute l'année → 06:00 UTC = 06:00 local.
-- cron.schedule(nom, ...) met à jour le job existant si le nom existe déjà
-- (pg_cron >= 1.4) → migration rejouable.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'reset-manual-close',
  '0 6 * * *',  -- chaque jour 06h00 (heure Dakar = UTC)
  $$
    UPDATE shops
    SET is_manually_closed = false,
        is_open = true
    WHERE is_manually_closed = true;
  $$
);
