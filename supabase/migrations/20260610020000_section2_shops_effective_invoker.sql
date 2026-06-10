-- ===========================================================================
-- LASSI — Section 2 (correctif post-vérification)
-- ---------------------------------------------------------------------------
-- La vue public.shops_effective (VIP/featured) est SECURITY DEFINER : elle
-- s'exécute avec les droits de son propriétaire (postgres, BYPASSRLS) et
-- contourne donc entièrement les policies RLS de la table shops, quel que
-- soit l'appelant.
--
-- Aujourd'hui, la lecture de "shops" est déjà publique (policy SELECT
-- ouverte à tous), donc cette vue n'expose pas de données supplémentaires.
-- Mais en SECURITY DEFINER, si la policy SELECT de "shops" est durcie plus
-- tard (ex: masquer les boutiques fermées/suspendues à certains rôles), la
-- vue continuerait à tout exposer silencieusement.
--
-- Fix : SECURITY INVOKER (PostgreSQL 17, supporté par le projet) — la vue
-- applique désormais les policies RLS de "shops" pour l'appelant réel.
-- Aucun changement de comportement actuel (lecture publique inchangée).
-- ===========================================================================

ALTER VIEW public.shops_effective SET (security_invoker = on);
