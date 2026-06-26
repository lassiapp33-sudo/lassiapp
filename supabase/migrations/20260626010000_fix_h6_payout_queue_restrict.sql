-- ===========================================================================
-- SÉCURITÉ H6 : payout_queue.prestataire_id → ON DELETE CASCADE dangereux
-- ---------------------------------------------------------------------------
-- Migration 20260624020000 a mis prestataire_id en CASCADE pour débloquer
-- la suppression de comptes admin. Problème : si un prestataire est supprimé
-- alors qu'il a des payouts en attente (queued/processing), ceux-ci
-- disparaissent silencieusement → perte financière non tracée.
--
-- Fix :
--   1. Passer la FK en ON DELETE RESTRICT : la DB bloque la suppression
--      tant qu'il reste des payouts actifs (protection niveau DB).
--   2. admin-delete-user vérifie en amont et retourne un message clair
--      (409 Conflict) si des payouts sont en attente.
-- ===========================================================================

ALTER TABLE public.payout_queue
  DROP CONSTRAINT IF EXISTS payout_queue_prestataire_id_fkey;

ALTER TABLE public.payout_queue
  ADD CONSTRAINT payout_queue_prestataire_id_fkey
  FOREIGN KEY (prestataire_id)
  REFERENCES public.profiles(id)
  ON DELETE RESTRICT;
