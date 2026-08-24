-- LASSI · Nettoyage emojis dans les badges de récompense
-- Certains enregistrements créés avant la migration 20260612160000 avaient
-- le badge "🎁 Bienvenue sur LASSI". On normalise vers le texte propre.

UPDATE recompenses_attribuees
SET badge = 'Bienvenue sur LASSI'
WHERE type_classement = 'bienvenue'
  AND badge IS NOT NULL
  AND badge <> 'Bienvenue sur LASSI';
