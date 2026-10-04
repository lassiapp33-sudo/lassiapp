-- Recrée get_beauty_creneaux_pris avec les bons alias de colonnes.
-- Bug: la version précédente retournait heure_debut/heure_fin (noms de la table)
-- mais le code TypeScript attend debut/fin (type CreneauBeauty).
-- Résultat: cp.debut = undefined → isCreneauBeauteDisponible retourne false pour
-- TOUS les créneaux dès qu'une seule réservation existe sur la journée.

DROP FUNCTION IF EXISTS get_beauty_creneaux_pris(uuid, date);

CREATE OR REPLACE FUNCTION get_beauty_creneaux_pris(
  p_prestataire_id uuid,
  p_date           date
)
RETURNS TABLE(debut text, fin text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    SUBSTRING(heure_debut::text, 1, 5) AS debut,
    SUBSTRING(heure_fin::text,   1, 5) AS fin
  FROM beauty_reservations
  WHERE prestataire_id  = p_prestataire_id
    AND date_reservation = p_date
    AND statut NOT IN ('annule', 'expire');
$$;

GRANT EXECUTE ON FUNCTION get_beauty_creneaux_pris(uuid, date) TO anon, authenticated;
