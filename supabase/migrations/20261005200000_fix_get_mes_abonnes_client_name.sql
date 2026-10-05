-- Fix get_mes_abonnes : afficher le vrai nom du client web invité
-- (payment_intents.metadata->>'client_name') au lieu du profil système "Commande web"
DROP FUNCTION IF EXISTS public.get_mes_abonnes();
CREATE FUNCTION public.get_mes_abonnes()
RETURNS TABLE (
  id                uuid,
  offre_id          uuid,
  client_id         uuid,
  prestataire_id    uuid,
  nom_offre         text,
  prix_paye         numeric,
  date_achat        timestamptz,
  date_expiration   timestamptz,
  statut            text,
  payment_intent_id uuid,
  client_name       text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
    COALESCE(
      NULLIF(TRIM(pi.metadata::json->>'client_name'), ''),
      p.name
    ) AS client_name
  FROM public.fitness_abonnements_clients fac
  LEFT JOIN public.profiles p ON p.id = fac.client_id
  LEFT JOIN public.payment_intents pi ON pi.id = fac.payment_intent_id
  WHERE fac.prestataire_id = auth.uid()
  ORDER BY fac.date_achat DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_mes_abonnes() TO authenticated;
