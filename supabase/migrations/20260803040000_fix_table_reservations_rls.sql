-- ===========================================================================
-- FIX : RLS table_reservations — gérant ne voit que les réservations payées
-- Appliqué manuellement via SQL Editor le 2026-08-03
-- ===========================================================================
--
-- Bug : la policy "reservations_select" laissait le gérant accéder directement
-- à toutes les réservations de son restaurant via la table, y compris celles
-- dont paiement_statut = 'en_attente' (pas encore payées).
-- La RPC get_reservations_gerant était déjà filtrée (migration 20260803030000),
-- mais un accès direct à la table contournait ce filtre.
--
-- Fix : ajouter AND paiement_statut = 'paye' dans la branche gérant.
-- Le client peut toujours voir ses propres réservations quelle que soit leur
-- valeur de paiement_statut (pour afficher l'état de son paiement en cours).
-- ===========================================================================

DROP POLICY IF EXISTS "reservations_select" ON public.table_reservations;

CREATE POLICY "reservations_select" ON public.table_reservations
  FOR SELECT USING (
    -- Le client voit toujours ses propres réservations (y compris en_attente)
    client_id = auth.uid()
    -- Le gérant ne voit que les réservations payées de son restaurant
    OR (
      EXISTS (
        SELECT 1 FROM public.vip_profils vp
        WHERE vp.id = table_reservations.vip_profil_id
          AND vp.gerant_user_id = auth.uid()
      )
      AND paiement_statut = 'paye'
    )
    -- Les admins voient tout
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

NOTIFY pgrst, 'reload schema';
