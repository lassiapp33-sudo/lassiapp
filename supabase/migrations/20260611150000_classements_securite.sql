-- ============================================================
-- LASSI · Système de classements & récompenses · Durcissement sécurité
-- Migration 2026-06-11 (Phase 5 ter — revue de sécurité)
-- ============================================================
-- Constats de la revue de sécurité :
--
-- 1) Par défaut, Postgres accorde EXECUTE sur toute nouvelle fonction à
--    PUBLIC, donc PostgREST exposait les 6 fonctions SECURITY DEFINER de
--    la migration 20260611120000 comme endpoints RPC appelables par
--    anon/authenticated. N'importe quel utilisateur aurait pu :
--      - gonfler artificiellement le score d'un prestataire/client
--        (ajouter_points_commande / ajouter_points_client)
--      - déclencher calculer_classement_* à tout moment, remettant à
--        zéro points_semaine/points_mois de TOUT LE MONDE et désactivant
--        les récompenses/carrousel en cours (déni de service du classement)
--    -> on retire EXECUTE de PUBLIC ; seuls postgres (pg_cron, superuser,
--       non concerné par les GRANT/REVOKE) et service_role (futures Edge
--       Functions) peuvent appeler ces fonctions.
--
-- 2) carrousel_presta_manage (20260611_classements.sql) permettait à
--    n'importe quel prestataire d'insérer ses propres produits dans le
--    carrousel public "Offre du Quartier", sans vérifier qu'il fait
--    partie du top 5 mondial du mois en cours.
--    -> on exige désormais une récompense active
--       (recompenses_attribuees.type_classement='mondial', est_actif=true,
--       carrousel_produits > 0) pour le prestataire courant.
--
-- 3) client_scores_owner (20260611_classements.sql) s'appelait "owner"
--    mais était défini avec USING (true), donc lisible par n'importe quel
--    utilisateur (même anonyme) pour TOUS les clients : score, marchand
--    préféré, nb de commandes. Le top 10 public est déjà exposé via
--    `classements` (type='client') — cette table brute n'a pas besoin
--    d'être publique.
--    -> restreint à auth.uid() = client_id (chaque client voit son propre
--       score, ex: "progression vers le prochain rang").
-- ============================================================

-- ------------------------------------------------------------
-- 1) Fonctions de scoring/calcul : retirer l'accès RPC public
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION ajouter_points_commande(uuid, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ajouter_points_client(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calculer_classement_sous_categorie(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calculer_classement_mondial(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calculer_classement_quartiers(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calculer_classement_clients(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ajouter_points_commande(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION ajouter_points_client(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION calculer_classement_sous_categorie(text) TO service_role;
GRANT EXECUTE ON FUNCTION calculer_classement_mondial(text) TO service_role;
GRANT EXECUTE ON FUNCTION calculer_classement_quartiers(text) TO service_role;
GRANT EXECUTE ON FUNCTION calculer_classement_clients(text) TO service_role;

-- ------------------------------------------------------------
-- 2) carrousel_offre_quartier : gestion réservée aux prestataires
--    qui détiennent une récompense mondiale active donnant droit
--    au carrousel
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "carrousel_presta_manage" ON carrousel_offre_quartier;
CREATE POLICY "carrousel_presta_manage" ON carrousel_offre_quartier
  FOR ALL USING (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement = 'mondial'
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  )
  WITH CHECK (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement = 'mondial'
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  );

-- ------------------------------------------------------------
-- 3) client_scores : un client ne voit que son propre score
--    (le top 10 public reste exposé via `classements`)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "client_scores_owner" ON client_scores;
CREATE POLICY "client_scores_owner" ON client_scores
  FOR SELECT USING (auth.uid() = client_id);
