# 🧪 SECTION 11 — Checklist de tests de sécurité (manuelle)

Pour chaque test : **échec / blocage = OK** (le système doit refuser, ignorer ou
neutraliser l'attaque). Si une action interdite réussit, c'est une régression
à corriger.

## Prérequis

```bash
SUPABASE_URL="https://tsdemraszwtbzgtyjzum.supabase.co"
ANON_KEY="<Settings → API → anon public, dans Lassi/.env>"
```

- **JWT utilisateur** : connecte-toi avec un compte de test, puis :
  ```bash
  curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"email":"221XXXXXXXXX@lassi.app","password":"..."}'
  ```
  → récupère `access_token` dans la réponse.
- **SQL Editor** (Supabase Dashboard → SQL Editor) : nécessaire pour les
  vérifications et les tests 9 et 11 (accès `service_role`/`postgres`,
  contourne la RLS mais pas les contraintes `CHECK`).
- **Secrets webhook** (`WAVE_WEBHOOK_SECRET` / `OM_WEBHOOK_SECRET`) :
  Dashboard → Edge Functions → Secrets — nécessaires pour les tests 2 et 10.
- Utilise un **compte de test dédié** pour les tests 6 et 7 (le test 6
  bloque temporairement le compte 30 min).

---

## 1. Webhook avec fausse signature → 401

**a) Aucun header de signature**
```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/webhook-payment" \
  -H "Content-Type: application/json" \
  -d '{"client_reference":"00000000-0000-0000-0000-000000000000","status":"succeeded","amount":1000}'
```
Attendu : `HTTP/2 401`, corps `Signature manquante`.

**b) Header présent, signature fausse**
```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/webhook-payment" \
  -H "Content-Type: application/json" \
  -H "X-Wave-Signature: sha256=0000000000000000000000000000000000000000000000000000000000000000" \
  -d '{"client_reference":"00000000-0000-0000-0000-000000000000","status":"succeeded","amount":1000}'
```
Attendu : `HTTP/2 401`, corps `Signature invalide`.

**Vérification** (SQL Editor) :
```sql
select action, metadata, created_at from audit_log
where action = 'webhook_invalid_signature'
order by created_at desc limit 5;
```
→ une nouvelle ligne pour le cas (b). Le cas (a) est rejeté avant la
vérification HMAC, donc pas de log (comportement normal).

✅ **OK si** : les deux requêtes renvoient 401 et qu'aucune ligne
`payment_intents` / `payment_logs` n'est créée ou modifiée.

---

## 2. Webhook dupliqué x10 → un seul traitement effectif

Récupère un `payment_intent` existant (ex : créé en mode simulation via
l'app) et son `montant_total` :
```sql
select id, statut, montant_total from payment_intents order by created_at desc limit 5;
```

```bash
WAVE_WEBHOOK_SECRET="<valeur configurée dans Edge Functions → Secrets>"
PI_ID="<uuid du payment_intent>"
MONTANT="<montant_total de ce payment_intent>"
BODY="{\"client_reference\":\"$PI_ID\",\"status\":\"succeeded\",\"amount\":$MONTANT}"
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WAVE_WEBHOOK_SECRET" | sed 's/^.* //')

for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/functions/v1/webhook-payment" \
    -H "Content-Type: application/json" \
    -H "X-Wave-Signature: $SIG" \
    -d "$BODY"
done
```

Attendu : les 10 requêtes renvoient `200` (le webhook répond toujours 200 sauf
401/400/500 explicites, pour ne jamais déclencher de retry Wave/OM).

**Vérification** :
```sql
select count(*) from payment_logs
where external_event_id = '<PI_ID>:succeeded';
-- → 1, même après 10 envois

select event_type, count(*) from payment_logs
where payment_intent_id = '<PI_ID>'
group by event_type;
-- → 'confirmed'/'split_done' (ou 'webhook_ignored'/'disputed') une seule fois

select count(*) from payout_queue where payment_intent_id = '<PI_ID>';
-- → 0 ou 1, jamais plus
```

✅ **OK si** : `count(external_event_id) = 1`, une seule transition d'état,
jamais plus d'une ligne `payout_queue` pour ce paiement.

---

## 3. Double appel initiate-payment sur la même commande → pas de double transaction

Pré-requis : un `orderId` au statut `'new'` + JWT du client propriétaire.

```bash
JWT="<access_token du client>"
ORDER_ID="<uuid de la commande>"

for i in 1 2; do
  curl -s -X POST "$SUPABASE_URL/functions/v1/create-payment" \
    -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"orderId\":\"$ORDER_ID\",\"moyenPaiement\":\"wave\"}"
  echo
done
```

Attendu :
- 1er appel : `{"success":true,"paymentIntentId":"...",...}`.
- 2e appel : si le 1er a déjà transitionné (`simulated`/`confirmed`/`split_done`)
  → `{"success":false,"error":"Cette commande a déjà été payée"}` (HTTP 409,
  `already_paid`). Sinon, la clé d'idempotence
  `pay_<orderId>_<montant>_<méthode>` fait que `create_payment_intent`
  renvoie le `payment_intent` **existant** (pas de nouvelle ligne).

**Vérification** :
```sql
select count(*) from payment_intents where order_id = '<ORDER_ID>';
-- → 1, jamais 2
```

✅ **OK si** : un seul `payment_intent` existe pour la commande, quel que soit
le nombre d'appels.

---

## 4. Montant falsifié depuis l'app → ignoré, serveur recalcule

`create-payment` n'accepte que `{ orderId, moyenPaiement }` — aucun montant
n'est envoyé par le client. Pour simuler une donnée falsifiée en amont,
modifie directement `orders.total` (simule un bypass côté app) :

```sql
update orders set total = total * 2 where id = '<ORDER_ID>';
```

Puis relance l'appel `create-payment` du test 3 pour cette commande.

Attendu : `initiate_order_payment` recalcule `v_items_total` depuis
`order_items` (jamais depuis `orders.total`). Comme
`v_items_total ≠ orders.total`, il renvoie `{ok:false, error:'amount_mismatch'}`
→ l'Edge Function répond `{"success":false,"error":"Incohérence détectée sur cette commande, contactez le support"}` (HTTP 409).

**Vérification** :
```sql
select count(*) from payment_intents where order_id = '<ORDER_ID>';
-- → 0
```

✅ **OK si** : HTTP 409 + `error:'amount_mismatch'`, et aucun `payment_intent`
créé. (Restaure `orders.total` après le test si tu veux repayer la commande
normalement.)

---

## 5. Accès aux données d'un autre user → refusé par RLS

Pré-requis : 2 comptes A et B, JWT de A, `id` du profil de B.

```bash
JWT_A="<access_token utilisateur A>"
USER_B_ID="<uuid profil B>"

curl -s "$SUPABASE_URL/rest/v1/profiles?id=eq.$USER_B_ID&select=*" \
  -H "Authorization: Bearer $JWT_A" -H "apikey: $ANON_KEY"
# → []

curl -s "$SUPABASE_URL/rest/v1/payment_intents?client_id=eq.$USER_B_ID&select=*" \
  -H "Authorization: Bearer $JWT_A" -H "apikey: $ANON_KEY"
# → []
```

Attendu : `[]` dans les deux cas — la policy `profiles_admin_read`
(`id = auth.uid() OR is_admin(auth.uid())`) ne laisse passer aucune ligne d'un
autre utilisateur en accès direct REST. Le seul accès légitime au profil de B
(nom/avatar, et téléphone si relation) passe par la RPC `get_profile_by_id`.

✅ **OK si** : les deux requêtes renvoient `[]` (jamais les données de B).

---

## 6. Bruteforce login → blocage après 5 tentatives

⚠️ Utilise un **compte de test dédié** (le compte sera bloqué 30 min).

```bash
PHONE="781234567"  # numéro du compte de test

for i in $(seq 1 6); do
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_auth_email_by_phone" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"p_phone\":\"$PHONE\"}"
  echo
done
```

Attendu :
- Tentatives 1 à 5 : renvoient l'email technique (ex: `"221781234567@lassi.app"`).
- Tentative 6 (dans la fenêtre de 15 min) : erreur HTTP 429, `code: "PT429"`,
  message `"Trop de tentatives de connexion. Réessaie dans X minute(s)."`.
- Reste bloqué 30 minutes (`blocked_until`).

**Vérification** :
```sql
select count, blocked_until from rate_limits where key = 'login:phone:' || '781234567';
-- → count >= 5, blocked_until ≈ now() + 30 min

select * from audit_log where action = 'rate_limit_reached' order by created_at desc limit 3;
```

✅ **OK si** : la 6e requête (et toutes les suivantes pendant 30 min)
renvoient `PT429` / HTTP 429.

---

## 7. Injection SQL dans les champs → bloqué

Action : crée un débiteur (cahier de dettes) avec un nom contenant une charge
SQL classique :

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/debtors" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"shop_id":"<SHOP_ID>","name":"'"'"'); DROP TABLE orders; --","phone":"781234567"}'
```

(ou via l'app, écran "Cahier de dettes" → ajouter un débiteur avec ce nom)

Attendu : la ligne est créée normalement, `name` contient **littéralement**
`'); DROP TABLE orders; --` — texte inerte. Toutes les écritures passent par
PostgREST/Supabase-js (requêtes paramétrées) ou des fonctions PL/pgSQL à
paramètres typés ; aucune concaténation de SQL dynamique avec une entrée
utilisateur n'existe dans le code.

**Vérification** :
```sql
select count(*) from orders;  -- doit toujours fonctionner (table intacte)
select name from debtors where name like '%DROP TABLE%';  -- chaîne brute stockée
```

✅ **OK si** : la table `orders` existe toujours et le `name` stocké est la
chaîne brute, sans aucun effet SQL.

---

## 8. XSS dans les noms/descriptions → échappé/bloqué

Action : modifie une boutique ou un produit avec comme nom/description :
```
<script>alert('xss')</script>
```
(via l'app, écran "Modifier ma boutique" / "Ajouter un produit")

Attendu :
- Stocké tel quel en base (`shops.name` / `products.description`).
- Affiché dans l'app (React Native `<Text>`) et dans `lassi-admin`
  (React, JSX `{...}`) comme **texte brut** — `<script>` apparaît à l'écran
  sans jamais s'exécuter (React/React Native échappent automatiquement le
  contenu de `Text`/JSX ; `dangerouslySetInnerHTML` n'est utilisé nulle part
  dans `lassi-admin`).
- Si ce contenu finit dans un email (`send-report-email`), il passe par
  `escapeHtml()` → `&lt;script&gt;alert('xss')&lt;/script&gt;`.

✅ **OK si** : le texte `<script>...</script>` s'affiche tel quel à l'écran
(pas de popup, pas d'exécution), partout où il est montré.

---

## 9. Numéro Wave invalide sur payout → `payout_failed`, argent gardé, admin alerté

Pré-requis : SQL Editor (service_role).

```sql
-- 1. Repérer un payout existant
select id, statut, attempts, payment_intent_id from payout_queue limit 5;

-- 2. Simuler l'échec terminal "numéro invalide" (ce que fait process-payouts
--    quand l'API Wave/OM répond "numéro invalide")
select payout_queue_mark_failure('<PAYOUT_ID>'::uuid, 'invalid_prestataire_phone', true);
```

Attendu (retour JSON) : `{"ok": true, "statut": "failed", "attempts": N}`.

**Vérification** :
```sql
select statut, attempts, last_error from payout_queue where id = '<PAYOUT_ID>';
-- → statut = 'failed' (jamais 'paid')

select event_type, event_data from payment_logs
where payment_intent_id = (select payment_intent_id from payout_queue where id = '<PAYOUT_ID>')
  and event_type = 'payout_failed';
-- → event_data contient "alert": true

select statut from payment_intents where id = (select payment_intent_id from payout_queue where id = '<PAYOUT_ID>');
-- → reste 'confirmed'/'split_done' : l'argent collecté n'est PAS perdu
```

✅ **OK si** : `statut='failed'` immédiatement (pas de retry car
`p_terminal=true`), une ligne `payment_logs` `event_type='payout_failed'`
avec `alert:true` (= signal admin), et le `payment_intent` reste confirmé
(argent gardé, reversement en attente d'intervention manuelle).

Pour le cas "échecs réseau avant échec terminal" (retry normal) : appelle
`payout_queue_mark_failure('<id>', 'wave_api_error', false)` plusieurs fois →
`statut` repasse en `'queued'` avec `next_attempt_at` croissant
(2min/10min/1h/6h), jusqu'à la 5e tentative où `statut='failed'` même sans
`p_terminal`.

---

## 10. Rejeu webhook après 24h → bloqué (idempotence)

Action : reprends EXACTEMENT le même `BODY`/`SIG` du test 2 et renvoie-les
(même des jours plus tard) :

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/webhook-payment" \
  -H "Content-Type: application/json" \
  -H "X-Wave-Signature: $SIG" \
  -d "$BODY"
```

Attendu : `200 OK`, traitement = `{"ok": true, "already_processed": true}`.

**Vérification** :
```sql
select count(*) from payment_logs where external_event_id = '<PI_ID>:succeeded';
-- → toujours 1, peu importe le délai écoulé
```

✅ **OK si** : aucune nouvelle transition d'état, `count = 1` même après
>24h. Note : la protection (index `UNIQUE` sur
`payment_logs.external_event_id`) est **permanente**, donc strictement plus
forte que la demande "bloqué après 24h" — il n'existe aucune fenêtre après
laquelle un rejeu redeviendrait possible.

---

## 11. Invariant comptable : gross ≠ commission + merchant → bloqué

Pré-requis : SQL Editor (service_role — bypass RLS, mais pas les contraintes
`CHECK`).

```sql
-- Doit échouer : montant_total ≠ prix_base + commission_lassi
insert into payment_intents (
  order_id, client_id, prestataire_id,
  prix_base, commission_lassi, montant_total,
  moyen_paiement, idempotency_key, statut
) values (
  '<order_id existant>', '<client_id existant>', '<prestataire_id existant>',
  10000, 100, 10500,  -- 10500 ≠ 10000 + 100 (devrait être 10100)
  'wave', 'test_invariant_' || gen_random_uuid(), 'pending'
);
```

Attendu :
```
ERROR:  new row for relation "payment_intents" violates check constraint "check_montants"
```

Variante (commission incorrecte, 1% de 10000 doit être CEIL = 100) :
```sql
insert into payment_intents (
  order_id, client_id, prestataire_id,
  prix_base, commission_lassi, montant_total,
  moyen_paiement, idempotency_key, statut
) values (
  '<order_id existant>', '<client_id existant>', '<prestataire_id existant>',
  10000, 99, 10099,
  'wave', 'test_invariant2_' || gen_random_uuid(), 'pending'
);
-- → même erreur check_montants
```

✅ **OK si** : les deux `INSERT` sont **rejetés** (`23514 check_violation`),
aucune ligne insérée. Cette contrainte
(`CHECK (commission_lassi = CEIL(prix_base * 0.01) AND montant_total = prix_base + commission_lassi)`)
est le filet de sécurité ultime au niveau base de données, même si
`create_payment_intent` calcule toujours juste.

Note : un client normal (`anon`/`authenticated`) ne peut de toute façon pas
faire cet `INSERT` — la policy `pi_client_insert` a été supprimée
(Section 2), seul `service_role` écrit dans `payment_intents`. Ce test vérifie
donc la **deuxième ligne de défense**.

---

## 12. Accès table "transactions" depuis l'app client → refusé par RLS

Le projet n'a pas de table nommée littéralement `transactions` — les données
financières sont dans `payment_intents`, `payment_logs` et `payout_queue`.

```bash
JWT="<access_token d'un client SANS paiement en cours>"

# a) payment_intents : aucune ligne sauf les siennes (client_id ou prestataire_id = soi)
curl -s "$SUPABASE_URL/rest/v1/payment_intents?select=*" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY"

# b) payment_logs : aucune ligne sauf celles liées à SES payment_intents
curl -s "$SUPABASE_URL/rest/v1/payment_logs?select=*" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY"

# c) payout_queue : SELECT filtré (prestataire_id = soi OU admin)
curl -s "$SUPABASE_URL/rest/v1/payout_queue?select=*" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY"

# d) tentative d'écriture directe (doit échouer pour TOUT compte)
curl -s -i -X POST "$SUPABASE_URL/rest/v1/payment_intents" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"<order existant>","client_id":"<auth.uid() de ce JWT>","prestataire_id":"<x>","prix_base":1000,"commission_lassi":10,"montant_total":1010,"moyen_paiement":"wave","idempotency_key":"hack_test","statut":"confirmed"}'
```

Attendu :
- (a)/(b)/(c) → `[]`, ou uniquement les lignes propres à ce compte.
- (d) → rejeté par RLS (`new row violates row-level security policy`),
  aucune ligne créée.

✅ **OK si** : (a)/(b)/(c) ne renvoient jamais les lignes d'un AUTRE
utilisateur, et (d) est bloqué — impossible de fabriquer un faux paiement
"confirmé" pour débloquer une commande sans payer.
