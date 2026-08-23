-- Fix : vip_horaires où ferme=false mais ouverture/fermeture sont NULL
-- Ces lignes causaient l'affichage "—" côté client (calculerStatut → ouvert=false)
-- On les marque ferme=true jusqu'à ce que le gérant entre des heures valides.
update public.vip_horaires
set ferme = true
where ferme = false
  and (ouverture is null or fermeture is null);
