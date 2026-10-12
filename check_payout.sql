-- Vérifier le statut final complet
SELECT
  pi.statut           AS pi_statut,
  pi.external_ref     AS om_ref,
  pi.confirmed_at,
  o.status            AS order_status,
  pq.statut           AS payout_statut,
  pq.montant          AS payout_montant,
  pq.attempts,
  pq.external_payout_ref,
  pq.last_error,
  pq.processed_at
FROM payment_intents pi
JOIN orders o ON o.id = pi.order_id
LEFT JOIN payout_queue pq ON pq.payment_intent_id = pi.id
WHERE pi.id = '138b559b-d805-446f-bdc6-3e26afbc665c';
