-- ─── Suivi du reversement pour reservations_terrain ─────────────────────────
-- payout_statut : NULL (non encore payé) | 'pending' (en attente) | 'ok' | 'erreur'
-- payout_ref    : référence retournée par Wave/OM
-- payout_at     : horodatage du reversement réussi
-- payout_erreur : message d'erreur si échec (pour diagnostic)

ALTER TABLE reservations_terrain
  ADD COLUMN IF NOT EXISTS payout_statut  text
    CHECK (payout_statut IN ('pending', 'ok', 'erreur')),
  ADD COLUMN IF NOT EXISTS payout_ref     text,
  ADD COLUMN IF NOT EXISTS payout_at      timestamptz,
  ADD COLUMN IF NOT EXISTS payout_erreur  text;

-- Les réservations déjà payées mais sans suivi payout → 'pending' pour permettre le retry
UPDATE reservations_terrain
SET payout_statut = 'pending'
WHERE statut = 'paye' AND payout_statut IS NULL;
