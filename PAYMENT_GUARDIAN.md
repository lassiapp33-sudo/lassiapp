# PAYMENT GUARDIAN — Mur Barrage Paiements LASSI

> **LIRE CE FICHIER AVANT TOUTE MODIFICATION touchant :**  
> `orders`, `payment_intents`, `payout_queue`, `payment_logs`,  
> Edge Functions : `create-payment`, `webhook-payment`, `process-payouts`, `verify-payment`,  
> Shared : `payment_utils.ts`, `waveProxy.ts`, `omAuth.ts`

---

## 🔒 INVARIANTS ABSOLUS (ne jamais modifier sans accord fondateur)

### 1. Taux de commission
| Contexte | Taux | Fichier source |
|---|---|---|
| Standard | **1%** | `_shared/payment_utils.ts` → `COMMISSION_RATE = 0.01` |
| VIP 5 Étoiles | **2%** | SQL `initiate_order_payment` → `WHEN v_is_vip THEN 0.02` |

**Règle :** Ces deux valeurs DOIVENT rester en sync. Si l'une change, l'autre change aussi.  
**Risque :** Un écart crée des `disputed` (montant webhook ≠ montant stocké) → zéro reversement.

### 2. Équation comptable (payment_intents)
```
montant_total = prix_base + commission_lassi + livraison_fee
```
Vérifiée par `process-payouts` **avant** chaque reversement. Violation → `amount_invariant_violation` terminal.

### 3. Chemin unique de confirmation
`process_payment_webhook` (RPC SQL) est le **seul** chemin qui confirme un paiement.  
- Webhook Wave → `webhook-payment` EF → `process_payment_webhook`  
- Webhook OM → `webhook-payment` EF (via `?source=om&pi_id=`) → `process_payment_webhook`  
- Polling app → `verify-payment` EF → `process_payment_webhook`  
- Polling web → `create-guest-order` EF (GET `?verify_order=`) → `process_payment_webhook`  
**Règle :** Ne jamais appeler `confirm_order_from_payment` directement depuis une EF.

### 4. Idempotence
- `payment_logs.external_event_id` UNIQUE → doublon webhook silencieusement ignoré
- `payout_queue` ON CONFLICT (payment_intent_id) DO NOTHING → pas de double payout
- `payout_queue_claim_batch` uses FOR UPDATE SKIP LOCKED → deux crons ne traitent jamais la même ligne

### 5. Signature Wave
Toute requête sortante vers Wave API doit passer par `waveProxy.ts` (`callWaveCheckout`, `waveRequestPayout`, `getWaveCheckout`).  
Ces fonctions ajoutent automatiquement le header `Wave-Signature` via `waveSign.ts`.  
**Règle :** Ne jamais appeler `fetch('https://api.wave.com/...')` directement.

### 6. verify_jwt OBLIGATOIREMENT false sur :
- `webhook-payment` — Wave/OM ne peuvent pas envoyer de JWT
- `create-guest-order` — invités sans compte
- `om-webhook` — Orange Money sans JWT

### 7. SERVICE_ROLE_KEY côté client = INTERDIT
Ne jamais exposer dans le code React Native / vitrine web.

### 8. Numéro prestataire
Format : `/^7[05678][0-9]{7}$/` (9 chiffres sénégalais).  
Un numéro invalide → payout terminal échoué. Vérifier `profiles.phone` du marchand.

### 9. insufficient-funds Wave = NON-TERMINAL
Si `LASSI Wave wallet` manque de fonds, le payout passe en retry (backoff), pas en failed.  
Action requise : recharger le portefeuille Wave Business LASSI.

### 10. IP Whitelist Wave = DÉSACTIVÉE
NE JAMAIS ajouter d'IP Wave tant que pas d'IP statique EAS — réactiverait le blocage immédiatement.

---

## ⚠️ BUGS HISTORIQUES (ne pas reproduire)

| Date | Bug | Cause | Fix |
|---|---|---|---|
| 2026-10-04 | Tous les app payouts failed | `COMMISSION_RATE=0.10` dans `payment_utils.ts` | Corrigé → `0.01` |
| 2026-10-04 | verify-payment UUID comme session ID | `external_ref ?? UUID` passé en session ID Wave | Fix : dual-mode (session ID si dispo, sinon client_reference search) |
| 2026-10-04 | OM visibility pack non activé | Webhook Wave path only | Fix : bloc OM symétrique dans webhook-payment |
| 2026-10-04 | reconcile-wave-payments subquery invalide | `.eq('id', sb.from(...))` passe un builder object | Fix : utiliser `row.order_id` directement |
| 2026-10-04 | Receipt code trigger ne tire jamais | `create_order_atomic` fixe pay_method dès INSERT | Fix : 2ème condition sur `pending→new` status |
| 2026-10-04 | Web payout "insufficient-funds" terminal | `insufficient-funds` dans TERMINAL_WAVE_ERRORS | Fix : retiré, admin notif + retry |

---

## 🔍 DIAGNOSTIC RAPIDE

### Vérifier l'état des paiements (SQL Editor)
```sql
-- Paiements en souffrance
SELECT statut, COUNT(*), SUM(montant_total)
FROM payment_intents
WHERE created_at > now() - interval '7 days'
GROUP BY statut ORDER BY COUNT(*) DESC;

-- Payouts bloqués
SELECT pq.statut, pq.last_error, pq.attempts, pi.moyen_paiement, pq.montant
FROM payout_queue pq
JOIN payment_intents pi ON pi.id = pq.payment_intent_id
WHERE pq.statut IN ('failed','queued','processing')
ORDER BY pq.created_at DESC LIMIT 20;

-- Paiements disputés (montant incohérent)
SELECT id, montant_total, prix_base, commission_lassi, livraison_fee, moyen_paiement, created_at
FROM payment_intents WHERE statut='disputed' ORDER BY created_at DESC;

-- Commandes payées sans payout_queue (orphelins)
SELECT pi.id, pi.order_id, pi.statut, pi.moyen_paiement, pi.montant_total
FROM payment_intents pi
WHERE pi.statut = 'split_done'
AND NOT EXISTS (SELECT 1 FROM payout_queue pq WHERE pq.payment_intent_id = pi.id)
ORDER BY pi.created_at DESC LIMIT 20;
```

### Health check complet
```sql
SELECT * FROM payment_health_check();
```

---

## 🚀 FLUX PAR CATÉGORIE

| Catégorie | Table panier/PI | Payout déclenché par |
|---|---|---|
| Produits (boutique) | `orders` + `payment_intents` | `confirm_order_from_payment` → `payout_queue` |
| Beauté (service) | `payment_intents` (metadata=beauty) | idem |
| Fitness (abonnement) | `payment_intents` (metadata=fitness) | idem |
| Terrain (réservation) | `payment_intents` (reservation_id) | idem + `verify-terrain-payment` |
| Table VIP | `payment_intents` (reservation_id) | idem |
| Livraison | `payment_intents` → `livraisons` | idem |
| Visibilité/Annonce | `visibility_subscriptions` | Webhook direct (pas `payout_queue`) |
| Commande web invitée | idem produits (client_id=guest) | idem produits |

---

## 📞 CONTACTS PAIEMENT

- **Wave AM :** Pauline Mendy — prm@wave.com
- **Wave Business :** business.wave.com — +221761890003
- **Supabase Dashboard :** Edge Functions logs → webhook-payment, process-payouts
