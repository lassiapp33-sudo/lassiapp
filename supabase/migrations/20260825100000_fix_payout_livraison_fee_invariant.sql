-- ===========================================================================
-- FIX : payout_queue_claim_batch ne retournait pas livraison_fee
-- Résultat : process-payouts rejetait les payouts "commande + livraison"
-- car montant_total != prix_base + commission_lassi (la livraison_fee était
-- oubliée dans l'invariant comptable).
--
-- 1. Ajouter livraison_fee dans le RETURNS TABLE + SELECT de claim_batch
-- 2. Remettre en 'queued' les payouts bloqués par cet invariant erroné
-- ===========================================================================

-- ─── 1. payout_queue_claim_batch : ajouter livraison_fee ─────────────────────
-- DROP requis car on change le RETURNS TABLE (ajout colonne livraison_fee)

DROP FUNCTION IF EXISTS public.payout_queue_claim_batch(INTEGER);

CREATE FUNCTION public.payout_queue_claim_batch(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id                     UUID,
  payment_intent_id      UUID,
  prestataire_id         UUID,
  montant                INTEGER,
  attempts               INTEGER,
  prestataire_phone      TEXT,
  moyen_paiement         TEXT,
  prix_base              INTEGER,
  commission_lassi       INTEGER,
  montant_total          INTEGER,
  livraison_fee          INTEGER,
  payment_intent_statut  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT pq.id
    FROM public.payout_queue pq
    WHERE pq.statut = 'queued'
      AND pq.next_attempt_at <= now()
    ORDER BY pq.created_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.payout_queue pq
    SET statut = 'processing', updated_at = now()
    FROM claimed
    WHERE pq.id = claimed.id
    RETURNING pq.id, pq.payment_intent_id, pq.prestataire_id, pq.montant, pq.attempts
  )
  SELECT
    u.id, u.payment_intent_id, u.prestataire_id, u.montant, u.attempts,
    pr.phone,
    pi.moyen_paiement, pi.prix_base, pi.commission_lassi, pi.montant_total,
    COALESCE(pi.livraison_fee, 0)::INTEGER,
    pi.statut
  FROM updated u
  JOIN public.profiles pr        ON pr.id = u.prestataire_id
  JOIN public.payment_intents pi ON pi.id = u.payment_intent_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.payout_queue_claim_batch(INTEGER) TO service_role;


-- ─── 2. Remettre en queued les payouts bloqués par amount_invariant_violation ─
-- Cause : livraison_fee > 0 → montant_total != prix_base + commission_lassi
-- On ne réinitialise que les lignes terminal=true avec cette erreur précise
-- ET dont le payment_intent a livraison_fee > 0, pour ne pas rouvrir de vrais
-- problèmes de montant.

UPDATE public.payout_queue pq
SET
  statut          = 'queued',
  last_error      = NULL,
  attempts        = 0,
  next_attempt_at = now(),
  updated_at      = now()
FROM public.payment_intents pi
WHERE pq.payment_intent_id = pi.id
  AND pq.statut      = 'failed'
  AND pq.last_error  = 'amount_invariant_violation'
  AND COALESCE(pi.livraison_fee, 0) > 0;
