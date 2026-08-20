-- ===========================================================================
-- Fix : badge Ouvert/Fermé de la liste 5 Étoiles incohérent avec la fiche.
--
-- Cause : get_vip_liste calculait est_ouvert côté serveur au moment
-- de la requête. FicheVip.tsx recalculait côté client au moment du rendu.
-- Si une ouverture/fermeture tombait entre les deux, les badges divergeaient.
--
-- Solution : exposer is_manually_closed + horaires du jour dans la réponse
-- afin que le client puisse recalculer en temps réel (même logique que FicheVip).
-- ===========================================================================

-- Le type de retour change → DROP obligatoire (PGRST203 si CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_vip_liste(public.vip_categorie);

CREATE FUNCTION public.get_vip_liste(
  p_categorie public.vip_categorie DEFAULT NULL
)
RETURNS TABLE (
  vip_profil_id      UUID,
  shop_id            UUID,
  nom_affiche        TEXT,
  baseline           TEXT,
  adresse_courte     TEXT,
  initiale           TEXT,
  gabarit            TEXT,
  categorie          public.vip_categorie,
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  rating             NUMERIC,
  est_ouvert         BOOLEAN,
  is_manually_closed BOOLEAN,
  today_ferme        BOOLEAN,
  today_ouverture    TEXT,
  today_fermeture    TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH horaire_auj AS (
    SELECT
      vh.vip_profil_id,
      vh.ferme,
      vh.ouverture::TEXT,
      vh.fermeture::TEXT
    FROM public.vip_horaires vh
    WHERE vh.jour = EXTRACT(DOW FROM NOW() AT TIME ZONE 'UTC')::SMALLINT
  )
  SELECT
    vp.id                AS vip_profil_id,
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
    -- est_ouvert conservé pour rétrocompatibilité
    CASE
      WHEN s.is_manually_closed              THEN FALSE
      WHEN h.vip_profil_id IS NULL           THEN FALSE
      WHEN h.ferme                           THEN FALSE
      WHEN h.ouverture IS NULL
        OR h.fermeture IS NULL               THEN FALSE
      ELSE (NOW() AT TIME ZONE 'UTC')::TIME
             BETWEEN h.ouverture::TIME AND h.fermeture::TIME
    END                  AS est_ouvert,
    s.is_manually_closed,
    COALESCE(h.ferme, TRUE)   AS today_ferme,
    h.ouverture::TEXT         AS today_ouverture,
    h.fermeture::TEXT         AS today_fermeture
  FROM public.vip_profils vp
  JOIN  public.shops s      ON s.id = vp.shop_id
  LEFT JOIN horaire_auj h   ON h.vip_profil_id = vp.id
  WHERE vp.actif = TRUE
    AND (p_categorie IS NULL OR vp.categorie = p_categorie)
  ORDER BY s.rating DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_vip_liste(public.vip_categorie) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
