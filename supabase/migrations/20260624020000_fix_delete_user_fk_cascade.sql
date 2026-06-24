-- ===========================================================================
-- LASSİ — Fix contraintes FK bloquant la suppression d'un utilisateur admin
-- ---------------------------------------------------------------------------
-- La fonction admin-delete-user échouait silencieusement car plusieurs tables
-- référencent profiles(id) avec ON DELETE NO ACTION (défaut PostgreSQL) :
-- la suppression du profil déclenchait une violation de contrainte.
--
-- Tables corrigées :
--   payment_intents.client_id        → CASCADE  (supprimer avec le compte)
--   payment_intents.prestataire_id   → CASCADE
--   reservations_terrain.client_id   → CASCADE
--   reservations_terrain.prestataire_id → CASCADE
--   payout_queue.prestataire_id      → CASCADE
--   fraud_flags.reviewed_by          → SET NULL (conserver le flag, délier le reviewer)
--   vip_settings.updated_by          → SET NULL (conserver les settings)
-- ===========================================================================


-- ── payment_intents ──────────────────────────────────────────────────────────

ALTER TABLE payment_intents
  DROP CONSTRAINT IF EXISTS payment_intents_client_id_fkey;
ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE payment_intents
  DROP CONSTRAINT IF EXISTS payment_intents_prestataire_id_fkey;
ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_prestataire_id_fkey
  FOREIGN KEY (prestataire_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ── reservations_terrain ─────────────────────────────────────────────────────

ALTER TABLE reservations_terrain
  DROP CONSTRAINT IF EXISTS reservations_terrain_client_id_fkey;
ALTER TABLE reservations_terrain
  ADD CONSTRAINT reservations_terrain_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE reservations_terrain
  DROP CONSTRAINT IF EXISTS reservations_terrain_prestataire_id_fkey;
ALTER TABLE reservations_terrain
  ADD CONSTRAINT reservations_terrain_prestataire_id_fkey
  FOREIGN KEY (prestataire_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ── payout_queue ─────────────────────────────────────────────────────────────

ALTER TABLE payout_queue
  DROP CONSTRAINT IF EXISTS payout_queue_prestataire_id_fkey;
ALTER TABLE payout_queue
  ADD CONSTRAINT payout_queue_prestataire_id_fkey
  FOREIGN KEY (prestataire_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ── fraud_flags ──────────────────────────────────────────────────────────────

ALTER TABLE fraud_flags
  DROP CONSTRAINT IF EXISTS fraud_flags_reviewed_by_fkey;
ALTER TABLE fraud_flags
  ADD CONSTRAINT fraud_flags_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;


-- ── vip_settings ─────────────────────────────────────────────────────────────

ALTER TABLE vip_settings
  DROP CONSTRAINT IF EXISTS vip_settings_updated_by_fkey;
ALTER TABLE vip_settings
  ADD CONSTRAINT vip_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
