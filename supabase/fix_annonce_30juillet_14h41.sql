-- ============================================================
-- FIX MANUEL : annonce OM du 30 juillet 2026 — 20 FCFA — MP260730.1441.C26858
-- Le webhook OM n'a pas activé l'abonnement → activation manuelle
-- ============================================================

-- ÉTAPE 1 : Trouver l'abonnement annonce bloqué
-- ============================================================
SELECT
  vs.id          AS subscription_id,
  vs.shop_id,
  vs.merchant_id,
  vs.amount,
  vs.status,
  vs.offer_type,
  vs.created_at,
  s.credit_balance AS solde_actuel
FROM visibility_subscriptions vs
JOIN shops s ON s.id = vs.shop_id
WHERE vs.offer_type = 'annonce'
  AND vs.status     = 'pending'
ORDER BY vs.created_at DESC
LIMIT 5;

-- ============================================================
-- ÉTAPE 2 : Activer l'abonnement + créditer la boutique
-- Remplacer <SUBSCRIPTION_ID> par l'id trouvé ci-dessus
-- ============================================================

-- 2a. Activer l'abonnement
/*
UPDATE visibility_subscriptions
SET
  status      = 'active',
  started_at  = NOW(),
  expires_at  = NOW() + INTERVAL '365 days',
  paid_at     = NOW(),
  transaction_id = 'MP260730.1441.C26858'
WHERE id = '<SUBSCRIPTION_ID>'
  AND status = 'pending';

-- 2b. Créditer la boutique du montant payé (20 crédits = 20 FCFA)
SELECT increment_shop_credit(
  (SELECT shop_id FROM visibility_subscriptions WHERE id = '<SUBSCRIPTION_ID>'),
  20
);

-- 2c. Vérifier le résultat
SELECT vs.id, vs.status, vs.expires_at, s.credit_balance
FROM visibility_subscriptions vs
JOIN shops s ON s.id = vs.shop_id
WHERE vs.id = '<SUBSCRIPTION_ID>';
*/
