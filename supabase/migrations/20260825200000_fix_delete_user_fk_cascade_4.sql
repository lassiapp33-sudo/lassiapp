-- ===========================================================================
-- Fix FK manquantes bloquant la suppression d'un utilisateur (4e lot)
-- ---------------------------------------------------------------------------
-- Problèmes identifiés :
--
--  1. admin_actions_log.target_user_id → profiles(id) sans ON DELETE SET NULL
--     → L'EF insère le log en step 5, puis profiles.delete() échoue en step 6
--       car la FK bloque la suppression. Résultat : profil non supprimé,
--       auth.deleteUser échoue aussi → rien ne se supprime.
--     Fix : ON DELETE SET NULL (préserve le log, délie juste la FK)
--
--  2. table_reservations.client_id → auth.users(id) sans ON DELETE CASCADE
--     → Si l'utilisateur a une réservation, auth.deleteUser échoue.
--     Fix : ON DELETE CASCADE
-- ===========================================================================

-- ── admin_actions_log.target_user_id ────────────────────────────────────────
ALTER TABLE public.admin_actions_log
  DROP CONSTRAINT IF EXISTS admin_actions_log_target_user_id_fkey;
ALTER TABLE public.admin_actions_log
  ADD CONSTRAINT admin_actions_log_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── table_reservations.client_id ────────────────────────────────────────────
ALTER TABLE public.table_reservations
  DROP CONSTRAINT IF EXISTS table_reservations_client_id_fkey;
ALTER TABLE public.table_reservations
  ADD CONSTRAINT table_reservations_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;
