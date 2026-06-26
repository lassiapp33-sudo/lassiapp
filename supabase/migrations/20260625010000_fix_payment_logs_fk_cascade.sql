-- ===========================================================================
-- SECURITE/BUG : payment_logs.payment_intent_id → ON DELETE SET NULL
-- ---------------------------------------------------------------------------
-- Problème : payment_logs.payment_intent_id référençait payment_intents(id)
-- avec NO ACTION (défaut PostgreSQL). Quand un utilisateur supprimait son compte :
--   auth.users → profiles (CASCADE) → payment_intents (CASCADE) → BLOQUÉ
--   car payment_logs pointait encore sur des payment_intents supprimés.
-- Résultat : delete-account échouait pour TOUS les utilisateurs ayant payé.
--
-- Fix : ON DELETE SET NULL — préserve les logs d'audit financiers (exigence
-- légale/comptable) mais délie le lien FK pour permettre la suppression.
-- Les détails du paiement restent dans event_data (JSONB immuable).
--
-- Bonus : index manquant sur payment_intents(prestataire_id) ajouté ici.
-- ===========================================================================

-- 1. Rendre payment_intent_id nullable (pour SET NULL)
ALTER TABLE public.payment_logs
  ALTER COLUMN payment_intent_id DROP NOT NULL;

-- 2. Remplacer la FK sans action par ON DELETE SET NULL
ALTER TABLE public.payment_logs
  DROP CONSTRAINT IF EXISTS payment_logs_payment_intent_id_fkey;

ALTER TABLE public.payment_logs
  ADD CONSTRAINT payment_logs_payment_intent_id_fkey
  FOREIGN KEY (payment_intent_id)
  REFERENCES public.payment_intents(id)
  ON DELETE SET NULL;

-- ===========================================================================
-- PERFORMANCE : index manquant sur payment_intents(prestataire_id)
-- La policy pi_prestataire_read et payout_queue_claim_batch faisaient
-- un full scan sans cet index.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_payment_intent_prestataire
  ON public.payment_intents(prestataire_id);
