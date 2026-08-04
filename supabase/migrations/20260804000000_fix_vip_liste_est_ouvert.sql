-- ===========================================================================
-- Fix : get_vip_liste retournait est_ouvert = (NOT is_manually_closed)
-- ce qui ignorait les horaires réels (vip_horaires).
-- Un établissement fermé à 20h restait "ouvert" toute la nuit.
--
-- Dakar = UTC+0, aucun décalage à appliquer.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_vip_liste(
  p_categorie public.vip_categorie DEFAULT NULL
)
RETURNS TABLE (
  vip_profil_id  UUID,
  shop_id        UUID,
  nom_affiche    TEXT,
  baseline       TEXT,
  adresse_courte TEXT,
  initiale       TEXT,
  gabarit        TEXT,
  categorie      public.vip_categorie,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  rating         NUMERIC,
  est_ouvert     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH horaire_auj AS (
    -- Récupère l'horaire du jour courant UTC (= heure Dakar) pour chaque profil
    SELECT
      vh.vip_profil_id,
      vh.ferme,
      vh.ouverture,
      vh.fermeture
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
    CASE
      -- Fermé manuellement → toujours fermé
      WHEN s.is_manually_closed THEN FALSE
      -- Pas d'horaire configuré pour aujourd'hui → fermé par défaut
      WHEN h.vip_profil_id IS NULL THEN FALSE
      -- Jour explicitement fermé
      WHEN h.ferme THEN FALSE
      -- Horaires mal configurés
      WHEN h.ouverture IS NULL OR h.fermeture IS NULL THEN FALSE
      -- Vérifier si l'heure courante est dans la plage d'ouverture
      ELSE (
        (NOW() AT TIME ZONE 'UTC')::TIME
          BETWEEN h.ouverture AND h.fermeture
      )
    END AS est_ouvert
  FROM public.vip_profils vp
  JOIN public.shops s ON s.id = vp.shop_id
  LEFT JOIN horaire_auj h ON h.vip_profil_id = vp.id
  WHERE vp.actif = TRUE
    AND (p_categorie IS NULL OR vp.categorie = p_categorie)
  ORDER BY s.rating DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_vip_liste(public.vip_categorie) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
