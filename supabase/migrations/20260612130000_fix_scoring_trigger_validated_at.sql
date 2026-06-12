-- ============================================================
-- LASSI · Correction trigger scoring commandes (Phase 11 bis)
-- Migration 2026-06-12
-- ============================================================
-- orders_status_check n'autorise que 'new'|'preparing'|'ready'|'done'|'refused' :
-- orders.status ne peut JAMAIS valoir 'validated' (cf. 20260612120000).
--
-- La "commande validée" est en réalité marquée par `validated_at`
-- (TIMESTAMPTZ, NULL -> now() lors de la confirmation de paiement /
-- du scan du reçu, voir colonnes receipt_code/receipt_status).
--
-- On corrige uniquement la condition de déclenchement du trigger créé
-- par 20260612120000 : premier passage validated_at NULL -> non NULL.
-- La fonction trg_scoring_commande_validee() (prestataire/sous-categorie/
-- quartier/client via shops + ajouter_points_commande/ajouter_points_client)
-- reste inchangée et correcte.
-- ============================================================

DROP TRIGGER IF EXISTS trg_orders_scoring ON orders;

CREATE TRIGGER trg_orders_scoring
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.validated_at IS NOT NULL AND OLD.validated_at IS NULL)
  EXECUTE FUNCTION trg_scoring_commande_validee();
