-- ============================================================
-- LASSI · Fitness — RPC get_mes_abonnes
-- Migration 2026-07-31
-- ============================================================
-- La jointure PostgREST client:client_id(name) retourne NULL
-- car la RLS de profiles bloque la lecture des profils tiers.
-- Cette RPC SECURITY DEFINER contourne la RLS et retourne
-- le vrai nom du client pour le prestataire connecté.
-- ============================================================

DROP FUNCTION IF EXISTS get_mes_abonnes();

CREATE OR REPLACE FUNCTION get_mes_abonnes()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date_achat DESC), '[]'::json)
    FROM (
      SELECT
        fac.id,
        fac.offre_id,
        fac.client_id,
        fac.prestataire_id,
        fac.nom_offre,
        fac.prix_paye,
        fac.date_achat,
        fac.date_expiration,
        fac.statut,
        fac.payment_intent_id,
        COALESCE(p.name, 'Client') AS client_name
      FROM fitness_abonnements_clients fac
      LEFT JOIN profiles p ON p.id = fac.client_id
      WHERE fac.prestataire_id = auth.uid()
    ) t
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_mes_abonnes() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_mes_abonnes() TO authenticated;
