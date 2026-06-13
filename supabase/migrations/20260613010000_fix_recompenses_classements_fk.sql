-- ============================================================
-- LASSI · Fix FK suppression de compte · Migration 2026-06-13
-- ============================================================
-- Erreur corrigée :
--   profiles(delete): update or delete on table "profiles" violates
--   foreign key constraint "recompenses_attribuees_prestataire_id_fkey"
--   on table "recompenses_attribuees"
--
-- Cause : les colonnes prestataire_id/client_id de recompenses_attribuees
-- et classements référencent profiles(id) sans ON DELETE, ce qui bloque
-- la suppression d'un profil (Edge Function delete-account).
-- ============================================================

-- ─── recompenses_attribuees.prestataire_id ──────────────────────────────
ALTER TABLE recompenses_attribuees
  DROP CONSTRAINT IF EXISTS recompenses_attribuees_prestataire_id_fkey;
ALTER TABLE recompenses_attribuees
  ADD CONSTRAINT recompenses_attribuees_prestataire_id_fkey
  FOREIGN KEY (prestataire_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── recompenses_attribuees.client_id ───────────────────────────────────
ALTER TABLE recompenses_attribuees
  DROP CONSTRAINT IF EXISTS recompenses_attribuees_client_id_fkey;
ALTER TABLE recompenses_attribuees
  ADD CONSTRAINT recompenses_attribuees_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── classements.prestataire_id ──────────────────────────────────────────
ALTER TABLE classements
  DROP CONSTRAINT IF EXISTS classements_prestataire_id_fkey;
ALTER TABLE classements
  ADD CONSTRAINT classements_prestataire_id_fkey
  FOREIGN KEY (prestataire_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── classements.client_id ────────────────────────────────────────────────
ALTER TABLE classements
  DROP CONSTRAINT IF EXISTS classements_client_id_fkey;
ALTER TABLE classements
  ADD CONSTRAINT classements_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── client_scores.prestataire_prefere_id (référence informative → SET NULL) ─
ALTER TABLE client_scores
  DROP CONSTRAINT IF EXISTS client_scores_prestataire_prefere_id_fkey;
ALTER TABLE client_scores
  ADD CONSTRAINT client_scores_prestataire_prefere_id_fkey
  FOREIGN KEY (prestataire_prefere_id) REFERENCES profiles(id) ON DELETE SET NULL;
