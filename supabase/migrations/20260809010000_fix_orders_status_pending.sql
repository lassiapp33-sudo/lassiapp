-- ===========================================================================
-- FIX : ajouter 'pending' à orders_status_check
-- ---------------------------------------------------------------------------
-- Migration 20260808020000 a introduit status='pending' dans create_order_atomic
-- pour les commandes Wave/OM (visibles uniquement après confirmation paiement).
-- Mais la contrainte CHECK n'a pas été mise à jour → crash à chaque commande
-- mobile non-cash.
-- ===========================================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'new', 'preparing', 'ready', 'done', 'refused'));
