-- ===========================================================================
-- LASSI — SECTION 2 : Tests d'isolation RLS
-- ---------------------------------------------------------------------------
-- À exécuter dans Supabase > SQL Editor (connecté avec un rôle privilégié,
-- ex: postgres). Chaque bloc simule un utilisateur authentifié via
-- `request.jwt.claims`, exactement comme le ferait PostgREST pour une requête
-- venant de l'app mobile (anon/authenticated key + JWT de session).
--
-- Remplace les UUID <...> par de vraies valeurs de ta base (un client A, un
-- client B, un marchand A propriétaire de shop A, un marchand B propriétaire
-- de shop B, etc.).
--
-- Convention :
--   SET ROLE authenticated;
--   SET request.jwt.claims = '{"sub": "<UUID>", "role": "authenticated"}';
--   ... requête à tester ...
--   RESET ROLE;  -- revient à postgres (bypass RLS) avant le bloc suivant
-- ===========================================================================


-- ===========================================================================
-- 1. PROFILES
-- Règle : un user lit uniquement son propre profil (table directe) +
--         name/avatar_url publics des autres via get_profile_by_id() ;
--         le téléphone n'est renvoyé que s'il existe une relation
--         (commande / conversation / réservation / paiement en commun).
-- ===========================================================================

-- 1a. Isolation : user A ne peut PAS lire la ligne profiles d'un user B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_A>", "role": "authenticated"}';

SELECT * FROM profiles WHERE id = '<UUID_USER_B>';
-- Attendu : 0 ligne

RESET ROLE;

-- 1b. get_profile_by_id : sans relation commune, le téléphone est NULL
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_A_SANS_LIEN>", "role": "authenticated"}';

SELECT * FROM get_profile_by_id('<UUID_USER_B>');
-- Attendu : full_name + avatar_url renseignés, phone = NULL

RESET ROLE;

-- 1c. get_profile_by_id : AVEC une commande/conversation en commun, le
--     téléphone est renvoyé
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_CLIENT_AVEC_COMMANDE>", "role": "authenticated"}';

SELECT * FROM get_profile_by_id('<UUID_MERCHANT_DE_LA_COMMANDE>');
-- Attendu : phone renseigné (relation via orders/conversations)

RESET ROLE;


-- ===========================================================================
-- 2. SHOPS
-- Règle : lecture publique, écriture (INSERT/UPDATE/DELETE) réservée au
--         merchant_id propriétaire.
-- ===========================================================================

-- 2a. Lecture publique OK même non authentifié
SET ROLE anon;
SELECT id, name, zone FROM shops LIMIT 5;
-- Attendu : retourne des lignes (lecture publique)
RESET ROLE;

-- 2b. Isolation écriture : marchand A ne peut PAS modifier la boutique B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_MERCHANT_A>", "role": "authenticated"}';

UPDATE shops SET name = 'Hack' WHERE id = '<UUID_SHOP_B>';
-- Attendu : UPDATE 0 (aucune ligne affectée — shop B appartient à merchant B)

RESET ROLE;


-- ===========================================================================
-- 3. PRODUCTS / SERVICES / FORMULAS (table unique `products`, item_type)
-- Règle : lecture publique, écriture réservée au propriétaire de shop_id.
-- ===========================================================================

-- 3a. Lecture publique OK
SET ROLE anon;
SELECT id, name, item_type, price FROM products LIMIT 5;
RESET ROLE;

-- 3b. Isolation écriture : marchand A ne peut PAS insérer un produit dans
--     la boutique B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_MERCHANT_A>", "role": "authenticated"}';

INSERT INTO products (shop_id, name, price)
VALUES ('<UUID_SHOP_B>', 'Produit pirate', 1000);
-- Attendu : ERROR 42501 (new row violates row-level security policy)

RESET ROLE;


-- ===========================================================================
-- 4. ORDERS
-- Règle : le client voit uniquement ses commandes (client_id = auth.uid()) ;
--         le marchand voit/modifie uniquement les commandes de SES boutiques.
--         INSERT : client_id doit être NULL ou = auth.uid(), status='new'.
-- ===========================================================================

-- 4a. Isolation lecture : client A ne peut PAS voir les commandes du client B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_CLIENT_A>", "role": "authenticated"}';

SELECT * FROM orders WHERE client_id = '<UUID_CLIENT_B>';
-- Attendu : 0 ligne

RESET ROLE;

-- 4b. Cross-shop : marchand A (propriétaire de shop A) ne peut PAS modifier
--     une commande de la boutique B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_MERCHANT_A>", "role": "authenticated"}';

UPDATE orders SET status = 'done' WHERE shop_id = '<UUID_SHOP_B>';
-- Attendu : UPDATE 0

RESET ROLE;

-- 4c. Anti-spoofing INSERT : un user ne peut PAS créer une commande au nom
--     d'un AUTRE client_id
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_A>", "role": "authenticated"}';

INSERT INTO orders (shop_id, client_id, total, status)
VALUES ('<UUID_SHOP_QUELCONQUE>', '<UUID_USER_B>', 5000, 'new');
-- Attendu : ERROR 42501 (client_id != auth.uid())

-- 4d. Anti-bypass INSERT : un user ne peut PAS créer une commande déjà
--     marquée 'done' (bypass du flux marchand/paiement)
INSERT INTO orders (shop_id, client_id, total, status)
VALUES ('<UUID_SHOP_QUELCONQUE>', '<UUID_USER_A>', 5000, 'done');
-- Attendu : ERROR 42501 (status != 'new')

RESET ROLE;


-- ===========================================================================
-- 5. DEBTS (cahier de dettes — strict propriétaire du shop)
-- Règle : FOR ALL réservé au merchant_id propriétaire du shop_id concerné.
-- ===========================================================================

-- 5a. Isolation : marchand A ne peut PAS lire les dettes de la boutique B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_MERCHANT_A>", "role": "authenticated"}';

SELECT * FROM debts WHERE shop_id = '<UUID_SHOP_B>';
-- Attendu : 0 ligne

-- 5b. Cross-shop : marchand A ne peut PAS créer une dette pour la boutique B
INSERT INTO debts (shop_id, client_name, amount)
VALUES ('<UUID_SHOP_B>', 'Client test', 1000);
-- Attendu : ERROR 42501

RESET ROLE;


-- ===========================================================================
-- 6. MESSAGES (+ conversations)
-- Règle : lecture/écriture réservées aux participants de la conversation
--         (client_id ou shops.merchant_id) ; UPDATE limité à type='ticket'.
-- ===========================================================================

-- 6a. Isolation : user A ne peut PAS lire les messages d'une conversation
--     dont il n'est PAS membre
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_A>", "role": "authenticated"}';

SELECT * FROM messages WHERE conversation_id = '<UUID_CONVERSATION_AUTRE>';
-- Attendu : 0 ligne

-- 6b. Anti-tampering : user A (participant) ne peut PAS modifier le contenu
--     d'un message texte (type='text') — seul type='ticket' est modifiable
UPDATE messages
SET content = 'message modifié'
WHERE conversation_id = '<UUID_CONVERSATION_DE_A>' AND type = 'text';
-- Attendu : UPDATE 0 (policy msg_update exige type='ticket')

RESET ROLE;


-- ===========================================================================
-- 7. TRANSACTIONS (table `payment_intents`)
-- Règle : SELECT réservé à client_id / prestataire_id ; AUCUNE policy
--         INSERT/UPDATE pour anon/authenticated (écriture via
--         create_payment_intent / confirm_order_from_payment, service_role
--         uniquement).
-- ===========================================================================

-- 7a. Isolation lecture : client A ne peut PAS voir les payment_intents
--     du client B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_CLIENT_A>", "role": "authenticated"}';

SELECT * FROM payment_intents WHERE client_id = '<UUID_CLIENT_B>';
-- Attendu : 0 ligne

-- 7b. Anti-faux-paiement : un client ne peut PAS insérer directement un
--     payment_intent "confirmé" pour valider sa commande sans payer
INSERT INTO payment_intents (
  order_id, client_id, prestataire_id,
  prix_base, commission_lassi, montant_total,
  moyen_paiement, idempotency_key, statut
) VALUES (
  '<UUID_ORDER_DE_A>', '<UUID_CLIENT_A>', '<UUID_MERCHANT_QUELCONQUE>',
  100, 1, 101, 'wave', 'fake-' || gen_random_uuid()::text, 'confirmed'
);
-- Attendu : ERROR 42501 (aucune policy INSERT — pi_client_insert supprimée)

-- 7c. Anti-bypass RPC : confirm_order_from_payment n'est plus exécutable
--     par un client (EXECUTE révoqué pour anon/authenticated)
SELECT confirm_order_from_payment('<UUID_PAYMENT_INTENT_QUELCONQUE>');
-- Attendu : ERROR 42501 (permission denied for function confirm_order_from_payment)

RESET ROLE;


-- ===========================================================================
-- 8. PAYMENT_EVENTS (table `payment_logs`)
-- Règle : SELECT réservé aux participants du payment_intent (via
--         payment_intent_id) ; logs immuables (RULE no_update / no_delete) ;
--         écriture via Edge Functions (service_role) uniquement.
-- ===========================================================================

-- 8a. Isolation lecture : client A ne peut PAS voir les logs d'un
--     payment_intent du client B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_CLIENT_A>", "role": "authenticated"}';

SELECT * FROM payment_logs WHERE payment_intent_id = '<UUID_PAYMENT_INTENT_DE_B>';
-- Attendu : 0 ligne

-- 8b. Immutabilité : même sur SES PROPRES logs, un client ne peut PAS
--     modifier ou supprimer une entrée (RULE ... DO INSTEAD NOTHING)
UPDATE payment_logs SET event_type = 'falsifie' WHERE payment_intent_id = '<UUID_PAYMENT_INTENT_DE_A>';
DELETE FROM payment_logs WHERE payment_intent_id = '<UUID_PAYMENT_INTENT_DE_A>';
-- Attendu : UPDATE 0 / DELETE 0 (la RULE absorbe silencieusement la requête)

RESET ROLE;


-- ===========================================================================
-- 9. DISPUTES (+ dispute_messages)
-- Règle : visible par reporter_id, against_id et admin ; UPDATE (résolution)
--         réservé à l'admin.
-- ===========================================================================

-- 9a. Isolation : user A ne peut PAS voir un litige dont il n'est ni
--     reporter ni accusé
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_A>", "role": "authenticated"}';

SELECT * FROM disputes WHERE id = '<UUID_DISPUTE_AUTRE>';
-- Attendu : 0 ligne

-- 9b. Un user normal (non-admin), même partie au litige, ne peut PAS
--     changer le statut/résolution (réservé à is_admin via Edge Function)
UPDATE disputes SET status = 'resolved', resolution = 'auto-résolu'
WHERE id = '<UUID_DISPUTE_DE_A>';
-- Attendu : UPDATE 0 (policy disputes_update exige is_admin(auth.uid()))

RESET ROLE;


-- ===========================================================================
-- 10. ADMIN_ACTIONS_LOG
-- Règle : SELECT réservé aux admins ; AUCUNE policy INSERT/UPDATE/DELETE
--         pour anon/authenticated (écriture via Edge Functions admin-*,
--         service_role uniquement → logs immuables).
-- ===========================================================================

-- 10a. Isolation lecture : un user normal (non-admin) ne voit AUCUNE entrée
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "<UUID_USER_NON_ADMIN>", "role": "authenticated"}';

SELECT * FROM admin_actions_log LIMIT 1;
-- Attendu : 0 ligne

-- 10b. Un admin ne peut PAS insérer/modifier/supprimer une entrée via le
--      client (anon/authenticated key) — même avec is_admin = TRUE
SET request.jwt.claims = '{"sub": "<UUID_ADMIN>", "role": "authenticated"}';

INSERT INTO admin_actions_log (admin_id, action, details)
VALUES ('<UUID_ADMIN>', 'self_insert_test', '{}');
-- Attendu : ERROR 42501 (aucune policy INSERT pour authenticated)

DELETE FROM admin_actions_log WHERE admin_id = '<UUID_ADMIN>';
-- Attendu : DELETE 0 (aucune policy DELETE pour authenticated)

RESET ROLE;
