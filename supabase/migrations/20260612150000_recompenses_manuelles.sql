-- ============================================================
-- LASSI · Récompenses manuelles (attribution admin)
-- Migration 2026-06-12 (Phase 13)
-- ============================================================
-- Permet à un admin (lassi-admin) d'attribuer manuellement à un
-- prestataire ou un client n'importe quelle récompense du système de
-- classement (badge, certificat, priorité recherche, crédit Lassi,
-- carrousel "Offre du Quartier", Top VIP), via une ligne
-- recompenses_attribuees avec type_classement = 'manuel', rang = 0.
-- L'insertion/désactivation se fait via l'Edge Function
-- admin-attribuer-recompense (service_role) — aucune nouvelle policy
-- d'écriture nécessaire, recompenses_attribuees est déjà en lecture
-- publique (recompenses_public_read).
--
-- carrousel_presta_manage (20260611150000_classements_securite.sql)
-- n'autorisait la gestion du carrousel "Offre du Quartier" qu'aux
-- prestataires détenant une récompense active type_classement='mondial'
-- avec carrousel_produits > 0. On élargit pour accepter aussi
-- type_classement='manuel', afin qu'un prestataire ayant reçu un quota
-- carrousel manuel puisse gérer sa sélection (setCarrouselSelection).
-- ============================================================

DROP POLICY IF EXISTS "carrousel_presta_manage" ON carrousel_offre_quartier;
CREATE POLICY "carrousel_presta_manage" ON carrousel_offre_quartier
  FOR ALL USING (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement IN ('mondial', 'manuel')
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  )
  WITH CHECK (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement IN ('mondial', 'manuel')
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  );
