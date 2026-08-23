-- ===========================================================================
-- LASSI — get_merchant_encaissements v2 (inclut reservations_terrain)
-- ---------------------------------------------------------------------------
-- v1 ne lisait que payout_queue (commandes + fitness).
-- v2 ajoute un UNION ALL sur reservations_terrain où payout_statut='ok',
-- ce qui couvre les prestataires terrain (Ball, etc.).
-- Colonnes identiques — aucune migration de données nécessaire.
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

  -- ── 1. Commandes + abonnements fitness (payout_queue) ────────────────────
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

  UNION ALL

  -- ── 2. Réservations terrain (reversement effectif LASSI→prestataire) ─────
  SELECT
    rt.id,
    rt.montant_prestataire                                        AS montant,
    'success'                                                     AS statut,
    COALESCE(rt.payout_at, rt.created_at)                        AS date_op,
    COALESCE(rt.moyen_paiement, 'wave')                          AS moyen_paiement,
    rt.payout_ref                                                 AS external_ref,
    NULL::UUID                                                    AS order_id,
    COALESCE(p.name, '—')                                        AS client_name,
    'terrain'                                                     AS type_op
  FROM public.reservations_terrain rt
  LEFT JOIN public.profiles p ON p.id = rt.client_id
  WHERE rt.prestataire_id = auth.uid()
    AND rt.payout_statut = 'ok'

  ORDER BY date_op DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_merchant_encaissements() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_merchant_encaissements() TO authenticated;

NOTIFY pgrst, 'reload schema';
