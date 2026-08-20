-- ===========================================================================
-- LASSI — RPC get_merchant_encaissements
-- ---------------------------------------------------------------------------
-- "Mes encaissements" lisait la table legacy `payments` (montant brut).
-- Cette table n'est plus alimentée pour fitness (fitness_abonnements_clients).
-- Fix : nouveau RPC qui lit payout_queue.montant (NET reversé par LASSI),
-- couvre toutes les sources (Wave, OM, abonnements fitness).
-- ===========================================================================

DROP FUNCTION IF EXISTS public.get_merchant_encaissements();

CREATE OR REPLACE FUNCTION public.get_merchant_encaissements()
RETURNS TABLE (
  id              UUID,
  montant         INTEGER,
  statut          TEXT,
  date_op         TIMESTAMPTZ,
  moyen_paiement  TEXT,
  external_ref    TEXT,
  order_id        UUID,
  client_name     TEXT,
  type_op         TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pq.id,
    pq.montant,
    CASE pq.statut
      WHEN 'paid'       THEN 'success'
      WHEN 'cancelled'  THEN 'refunded'
      WHEN 'failed'     THEN 'failed'
      ELSE                   'pending'
    END                                                           AS statut,
    COALESCE(pq.processed_at, pq.created_at)                     AS date_op,
    COALESCE(pi.moyen_paiement, 'wave')                          AS moyen_paiement,
    pi.external_ref,
    pi.order_id,
    COALESCE(p.name, '—')                                        AS client_name,
    CASE
      WHEN (pi.metadata ->> 'offre_nom') IS NOT NULL THEN 'fitness'
      ELSE 'order'
    END                                                           AS type_op
  FROM public.payout_queue pq
  JOIN public.payment_intents pi ON pi.id = pq.payment_intent_id
  LEFT JOIN public.profiles p    ON p.id  = pi.client_id
  WHERE pq.prestataire_id = auth.uid()
    AND pq.statut IN ('queued', 'processing', 'paid')
  ORDER BY COALESCE(pq.processed_at, pq.created_at) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_merchant_encaissements() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_merchant_encaissements() TO authenticated;

NOTIFY pgrst, 'reload schema';
