-- ============================================================
-- FIX MANUEL : paiement OM du 24 juillet 2026 bloqué en 'initiated'
-- Référence OM : MP260724.1751.D48589 — Montant : 11 FCFA
-- ============================================================
-- ÉTAPE 1 : Trouver le payment_intent bloqué
-- ============================================================

SELECT
  pi.id,
  pi.statut,
  pi.montant_total,
  pi.moyen_paiement,
  pi.created_at,
  pi.external_ref,
  o.id AS order_id,
  o.status AS order_status,
  o.client_name,
  o.total
FROM payment_intents pi
LEFT JOIN orders o ON o.id = pi.order_id
WHERE pi.moyen_paiement = 'orange_money'
  AND pi.statut = 'initiated'
  AND pi.created_at >= '2026-07-24 17:00:00'
  AND pi.created_at <= '2026-07-24 18:30:00'
ORDER BY pi.created_at DESC;

-- ============================================================
-- ÉTAPE 2 : Confirmer manuellement (après avoir vérifié l'ID)
-- Remplacer [PAYMENT_INTENT_ID] par l'ID trouvé à l'étape 1
-- ============================================================

-- UPDATE payment_intents SET
--   statut = 'confirmed',
--   external_status = 'SUCCESS_MANUAL',
--   external_ref = 'MP260724.1751.D48589',
--   confirmed_at = NOW(),
--   updated_at = NOW()
-- WHERE id = '[PAYMENT_INTENT_ID]'
--   AND statut = 'initiated';

-- SELECT confirm_order_from_payment('[PAYMENT_INTENT_ID]');
