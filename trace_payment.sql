-- 1. payment_intents 3030 FCFA autour de 21h07
SELECT id, type, statut, montant_base, montant_total, moyen_paiement,
       client_id, prestataire_id, metadata, created_at
FROM payment_intents
WHERE montant_total = 3030
  AND created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00'
ORDER BY created_at;

-- 2. payment_logs
SELECT event_type, reference, ticket_id, user_id, amount, method,
       provider, status, provider_response, created_at
FROM payment_logs
WHERE amount IN (3000, 3030)
  AND created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00'
ORDER BY created_at;

-- 3. orders
SELECT o.id, o.total, o.statut, o.client_id, o.client_name,
       s.name AS shop_name, s.merchant_id, o.created_at
FROM orders o
JOIN shops s ON s.id = o.shop_id
WHERE o.total IN (3000, 3030)
  AND o.created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00';

-- 4. reservations terrain
SELECT id, statut, montant_total, montant_prestataire,
       client_id, prestataire_id, payout_statut, moyen_paiement, created_at
FROM reservations_terrain
WHERE montant_total IN (3000, 3030)
  AND created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00';

-- 5. fitness abonnements
SELECT id, nom_offre, prix_paye, statut, client_id, prestataire_id, payment_intent_id, created_at
FROM fitness_abonnements_clients
WHERE prix_paye IN (3000, 3030)
  AND created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00';

-- 6. payout_queue pour ce montant
SELECT id, payment_intent_id, beneficiaire_id, montant, statut, moyen_paiement, created_at
FROM payout_queue
WHERE montant IN (2970, 3000)
  AND created_at BETWEEN '2026-10-11 20:50:00+00' AND '2026-10-11 21:20:00+00';
