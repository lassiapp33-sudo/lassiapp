-- ================================================================
-- FIX: 2 sessions Wave payées mais payment_intents absents en DB
-- Source: Historique Wave PDF 2026-08-17 à 2026-08-24
--
-- Preuve: la colonne "Référence client" du PDF Wave = UUID du PI
--   cos-26vtajbr814je → PI UUID a413023d-f48b-444c-9e60-f7ba8a75c61f (10 FCFA, 22:33 UTC)
--   cos-26vtbfm0g17pt → PI UUID 459d8f45-cf72-45cd-a513-78944876cda9 (20 FCFA, 22:35 UTC)
--
-- Cause: l'EF a créé le checkout Wave PUIS crashé avant l'INSERT payment_intent
-- client_id   : 80aa0079-0bb5-484e-84d9-0f30f9ccce7a  (confirmé diagnostic)
-- prestataire : 32efa610-e756-4052-ad6c-d4c0a15334eb  (même que les 4 split_done du 24/08)
-- ================================================================


-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Trouver les order_ids correspondants
-- Coller dans Supabase SQL Editor → RUN → noter les UUIDs
-- ═══════════════════════════════════════════════════════════════

SELECT
  id                                                        AS order_id,
  to_char(created_at AT TIME ZONE 'UTC', 'HH24:MI:SS')    AS heure_utc,
  statut,
  total,
  type
FROM orders
WHERE client_id    = '80aa0079-0bb5-484e-84d9-0f30f9ccce7a'
  AND prestataire_id = '32efa610-e756-4052-ad6c-d4c0a15334eb'
  AND created_at BETWEEN '2026-08-24 22:20:00+00' AND '2026-08-24 22:50:00+00'
ORDER BY created_at;

-- → La ligne vers 22:33 → order_id pour la transaction 10 FCFA
-- → La ligne vers 22:35 → order_id pour la transaction 20 FCFA
-- Si aucune ligne : l'order_id est NULL (voir note ÉTAPE 2)


-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Insérer les payment_intents manquants
-- Remplacer '<ORDER_ID_10FCFA>' et '<ORDER_ID_20FCFA>'
-- par les UUIDs trouvés à l'étape 1.
-- Si aucun order trouvé, mettre NULL (si la colonne l'accepte)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO payment_intents (
  id,
  order_id,
  client_id,
  prestataire_id,
  prix_base,
  commission_lassi,
  montant_total,
  livraison_fee,
  moyen_paiement,
  external_ref,
  statut,
  idempotency_key,
  created_at
) VALUES
(
  'a413023d-f48b-444c-9e60-f7ba8a75c61f',   -- UUID Wave PDF cos-26vtajbr814je
  '<ORDER_ID_10FCFA>',                        -- ← remplir depuis étape 1 (ou NULL)
  '80aa0079-0bb5-484e-84d9-0f30f9ccce7a',
  '32efa610-e756-4052-ad6c-d4c0a15334eb',
  9,                                          -- prix_base = montant_total - commission
  1,                                          -- commission LASSI (min 1 FCFA)
  10,                                         -- montant Wave PDF
  0,
  'wave',
  'cos-26vtajbr814je',
  'confirmed',
  'manual_fix_wave_vtajbr_20260824',
  '2026-08-24 22:33:57+00'
),
(
  '459d8f45-cf72-45cd-a513-78944876cda9',   -- UUID Wave PDF cos-26vtbfm0g17pt
  '<ORDER_ID_20FCFA>',                        -- ← remplir depuis étape 1 (ou NULL)
  '80aa0079-0bb5-484e-84d9-0f30f9ccce7a',
  '32efa610-e756-4052-ad6c-d4c0a15334eb',
  19,
  1,
  20,
  0,
  'wave',
  'cos-26vtbfm0g17pt',
  'confirmed',
  'manual_fix_wave_vtbfm0_20260824',
  '2026-08-24 22:35:53+00'
);


-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Créer les entrées payout_queue pour le prestataire
-- Le prestataire n'a PAS reçu son argent pour ces 2 sessions.
-- Ces 28 FCFA sont actuellement bloqués dans le compte Wave LASSI.
-- À exécuter APRÈS l'étape 2.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO payout_queue (
  payment_intent_id,
  prestataire_id,
  montant,
  statut,
  moyen_paiement,
  attempts,
  created_at
) VALUES
(
  'a413023d-f48b-444c-9e60-f7ba8a75c61f',
  '32efa610-e756-4052-ad6c-d4c0a15334eb',
  9,         -- prix_base = ce que reçoit le prestataire
  'queued',
  'wave',
  0,
  now()
),
(
  '459d8f45-cf72-45cd-a513-78944876cda9',
  '32efa610-e756-4052-ad6c-d4c0a15334eb',
  19,
  'queued',
  'wave',
  0,
  now()
);


-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 4 : Vérification finale
-- ═══════════════════════════════════════════════════════════════

SELECT
  pi.id,
  pi.statut,
  pi.external_ref,
  pi.montant_total,
  pq.id        AS payout_id,
  pq.montant   AS payout_montant,
  pq.statut    AS payout_statut
FROM payment_intents pi
LEFT JOIN payout_queue pq ON pq.payment_intent_id = pi.id
WHERE pi.external_ref IN ('cos-26vtajbr814je', 'cos-26vtbfm0g17pt');

-- Résultat attendu : 2 lignes, statut=confirmed, payout_statut=queued
-- Le cron de payout enverra automatiquement les 9+19=28 FCFA au prestataire
