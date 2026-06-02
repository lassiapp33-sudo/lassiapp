-- ===========================================================================
-- Fix : contraintes FK bloquant la suppression définitive d'un utilisateur
-- Sans ça, supprimer un profil échoue car le log / litiges référencent encore
-- l'utilisateur via des FK sans ON DELETE SET NULL / CASCADE.
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ===========================================================================

-- ─── admin_actions_log.target_user_id (nullable → SET NULL) ──────────────────
ALTER TABLE admin_actions_log
  DROP CONSTRAINT IF EXISTS admin_actions_log_target_user_id_fkey;

ALTER TABLE admin_actions_log
  ADD CONSTRAINT admin_actions_log_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── admin_actions_log.target_shop_id (nullable → SET NULL) ──────────────────
ALTER TABLE admin_actions_log
  DROP CONSTRAINT IF EXISTS admin_actions_log_target_shop_id_fkey;

ALTER TABLE admin_actions_log
  ADD CONSTRAINT admin_actions_log_target_shop_id_fkey
  FOREIGN KEY (target_shop_id) REFERENCES shops(id) ON DELETE SET NULL;

-- ─── disputes.resolved_by (nullable → SET NULL) ───────────────────────────────
ALTER TABLE disputes
  DROP CONSTRAINT IF EXISTS disputes_resolved_by_fkey;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Note : disputes.reporter_id et disputes.against_id sont NOT NULL et ne peuvent
-- pas être mis à NULL. L'Edge Function admin-delete-user les supprime
-- explicitement avant de supprimer le profil.
