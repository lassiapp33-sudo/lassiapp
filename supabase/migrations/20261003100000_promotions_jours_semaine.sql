-- Ajoute le filtre jour-de-semaine aux promotions.
-- jours_semaine integer[] : 0=Dim 1=Lun 2=Mar 3=Mer 4=Jeu 5=Ven 6=Sam
-- NULL = tous les jours (comportement actuel inchangé)
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS jours_semaine integer[] DEFAULT NULL;
