-- ===========================================================================
-- LASSI — Section 4 : Validation des entrées (anti-injection, anti-manipulation)
-- ---------------------------------------------------------------------------
-- Contrainte de format au niveau base de données pour profiles.phone :
-- format sénégalais local, 9 chiffres, préfixes valides 70/75/76/77/78
-- (ex : "781376161"). NULL reste autorisé (numéro non renseigné).
--
-- Ajoutée en NOT VALID : les lignes existantes ne sont pas vérifiées
-- immédiatement (pas de blocage si des données antérieures ne respectent
-- pas encore le format). Une fois les données nettoyées, valider avec :
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_phone_format_check;
-- ===========================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_format_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_format_check
  CHECK (phone IS NULL OR phone ~ '^7[05678][0-9]{7}$') NOT VALID;
