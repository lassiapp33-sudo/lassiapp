-- ===========================================================================
-- FIX : get_vip_liste — filtre catégorie inopérant
-- ---------------------------------------------------------------------------
-- Cause : le paramètre p_categorie était typé public.vip_categorie (ENUM).
-- PostgREST a du mal à caster une chaîne JSON vers un type ENUM custom quand
-- l'appel vient d'un fetch() brut. Le filtre retournait toujours NULL et la
-- clause (p_categorie IS NULL) était toujours vraie → tous les profils passaient.
--
-- Correctif : on accepte TEXT et on caste à l'intérieur → aucun risque PGRST203
-- car on DROP l'ancienne signature ENUM avant de créer la nouvelle TEXT.
-- ===========================================================================

-- 1. Supprimer l'ancienne signature ENUM
DROP FUNCTION IF EXISTS public.get_vip_liste(public.vip_categorie);

-- 2. Recréer avec TEXT — cast interne sécurisé
CREATE OR REPLACE FUNCTION public.get_vip_liste(
  p_categorie text default null
)
RETURNS TABLE (
  vip_profil_id  uuid,
  shop_id        uuid,
  nom_affiche    text,
  baseline       text,
  adresse_courte text,
  initiale       text,
  gabarit        text,
  categorie      public.vip_categorie,
  latitude       double precision,
  longitude      double precision,
  rating         numeric,
  est_ouvert     boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vp.id                      AS vip_profil_id,
    vp.shop_id,
    vp.nom_affiche,
    vp.baseline,
    vp.adresse_courte,
    vp.initiale,
    vp.gabarit,
    vp.categorie,
    s.latitude,
    s.longitude,
    s.rating,
    (NOT s.is_manually_closed) AS est_ouvert
  FROM public.vip_profils vp
  JOIN public.shops s ON s.id = vp.shop_id
  WHERE vp.actif = true
    AND (
      p_categorie IS NULL
      OR p_categorie = ''
      OR vp.categorie = p_categorie::public.vip_categorie
    )
  ORDER BY s.rating DESC NULLS LAST;
$$;

-- 3. Droits
REVOKE EXECUTE ON FUNCTION public.get_vip_liste(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_vip_liste(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
