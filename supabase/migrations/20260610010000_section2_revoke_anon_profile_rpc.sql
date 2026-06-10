-- ===========================================================================
-- LASSI — Section 2 (correctif post-vérification)
-- ---------------------------------------------------------------------------
-- has_relationship_with / get_profile_by_id sont créées via CREATE FUNCTION
-- (propriétaire postgres) : les "default privileges" du projet Supabase
-- accordent automatiquement EXECUTE à anon/authenticated/service_role sur
-- toute nouvelle fonction du schéma public, indépendamment du
-- "REVOKE ALL ... FROM PUBLIC" de la migration précédente (qui ne révoque que
-- le privilège hérité de PUBLIC, pas le GRANT direct à anon).
--
-- Résultat avant ce correctif : un appelant NON authentifié (anon) pouvait
-- appeler get_profile_by_id(uuid_quelconque) et récupérer full_name +
-- avatar_url de N'IMPORTE QUEL profil (énumération en masse possible),
-- alors que le seul usage légitime (getClientProfile dans chat.ts) est
-- réservé aux utilisateurs authentifiés. phone restait NULL (has_relationship_with
-- renvoie false quand auth.uid() IS NULL), donc pas de fuite de PII sensible,
-- mais l'accès anon n'était pas voulu.
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.has_relationship_with(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_by_id(UUID) FROM anon;

NOTIFY pgrst, 'reload schema';
