# LASSI MÉMOIRE — Fichier de référence permanent
# Créé le 2026-08-09 par Claude
# Tout ce que tu me dis de retenir se stocke ici.
# Pour l'utiliser : dis à Claude "regarde LASSI_MEMOIRE.md" ou "souviens-toi de X"
# ──────────────────────────────────────────────────────────────────────────────

---

## 1. IDENTITÉ DU PROJET

**Nom :** LASSI  
**Type :** Application mobile d'intermédiation économique (marketplace de proximité)  
**Marché :** Dakar, Sénégal — secteur informel (Tanganas, boutiques de quartier, dibiteries, coiffeurs, salles de sport)  
**Stack :** React Native 0.81 + Expo SDK 54 + TypeScript + Supabase + Zustand  
**Répertoire principal :** `C:\Users\USER\Desktop\lassiapp\Lassi\`

**Charte graphique stricte (NE JAMAIS CHANGER) :**
- Fond : `#14152A` (Bleu Nuit)
- CTA / Accent : `#FDCF34` (Jaune Éclatant)
- Texte principal : `#FFFFFF`
- Texte muted : `#9A9BB0`
- Surface carte : `#1E2040`
- Bordure : `#2A2C52`
- Succès : `#5FD38A`
- Danger : `#E07A7A`
- Orange : `#F0A847`

---

## 2. ENTITÉ LÉGALE

**Raison sociale :** COULIBALY LASSANA (entreprise individuelle)  
**Nom commercial :** LASSI  
**NINEA :** 013082079  
**RCCM :** SN DKR 2026 A 19335 (immatriculé le 15/05/2026)  
**Adresse :** Guédiawaye Golf Sud Fith Mith, Dakar, Sénégal

---

## 3. COMPTES ET CONTACTS

### Publication
- **Site web :** https://lassi.tech
- **Politique de confidentialité :** https://lassi.tech/privacy.html ✅ (en ligne)
- **Email support :** lassiapp33@gmail.com
- **WhatsApp :** +221 76 189 00 03

### Compte démo Google Play (pour reviewers)
- **Email :** reviewer.googleplay@lassi.tech
- **Mot de passe :** 781235465
- **Type :** Client — créé le 07/08/2026

### Compte Wave Business
- **Numéro marchand :** +221761890003
- **Portail :** https://business.wave.com
- **Account Manager :** Pauline Mendy
- **Support technique :** prm@wave.com

### Projets liés (repos lassiapp33-sudo)
| Projet | Type | Dossier local |
|--------|------|---------------|
| hadama | CRM interne (Next.js 15) | `C:\Users\USER\Desktop\hadama` |
| coumba | Marketing interne (Next.js 15) | `C:\Users\USER\Desktop\coumba` |
| lassiweb | Site vitrine | GitHub |
| lassiapp | App mobile | `C:\Users\USER\Desktop\lassiapp` |

---

## 4. ARCHITECTURE TECHNIQUE

### Frontend (Lassi/)
- Navigation : state machine locale dans `App.tsx` (pas de React Navigation)
- Thème centralisé : `src/theme.ts` (colors, radius, fonts, TOP_INSET)
- Fonts : PlusJakartaSans (500/600/700/800) + Poppins_300Light
- Stores Zustand v5 : authStore, cartStore, favoritesStore, notificationsStore, ordersStore, debtsStore, shopStore
- Monnaie : toujours `{value.toLocaleString('fr-FR')} F` — JAMAIS "FCFA"

### Backend (Supabase)
- URL : `https://tsdemraszwtbzgtyjzum.supabase.co`
- Auth, RLS, Storage, Edge Functions : tout dans Supabase
- Firebase : Crashlytics + FCM push uniquement

### Dashboard Admin (lassi-admin/)
- Stack : React + Vite + Supabase
- Auth : vérifie `profiles.is_admin = true`
- Edge Functions protégées : `admin-set-featured`, `admin-resolve-dispute`

---

## 5. MODÈLE ÉCONOMIQUE — RÈGLE ABSOLUE

### Commission LASSI dans l'app = **1% PARTOUT**
- Le client paie `prix_base + 1%` (ex : 100 FCFA → client paie 101 FCFA)
- LASSI encaisse le 1% directement
- Le prestataire reçoit `prix_base` (avant frais Wave/OM)

### Exception : Établissements 5 Étoiles = **2%**
- Les restaurants/établissements VIP 5 Étoiles paient 2% à LASSI (service premium)

### Les 10% = INTERNE LIVREURS UNIQUEMENT
- Uniquement prélevés sur les gains des **livreurs** (pas des prestataires, pas des clients)
- Visible uniquement dans le dashboard admin → section Livreurs
- **Ne JAMAIS mettre 10% dans l'app cliente ou prestataire**

### Frais Wave (supportés par le prestataire)
- 1% à l'encaissement + 1% au reversement = ~2% au total côté prestataire
- Client Wave : 0 frais

### Frais Orange Money
- Client OM : paie 1% OM en plus du prix
- Prestataire OM : reçoit montant − 0,5% OM

---

## 6. PROTOCOLES OBLIGATOIRES

### Lancer l'app en développement
```powershell
# TOUJOURS depuis C:\Users\USER\Desktop\lassiapp
.\tunnel-cloudflared.ps1
# NE JAMAIS utiliser "npx expo start" seul
```

### Protocole bug production (OTA d'abord)
1. **Bug JS/UI/Supabase** → `eas update --channel production` (0 build consommé)
2. **Bug Edge Function** → `supabase functions deploy [nom]` (0 build)
3. **Bug natif** → Local APK d'abord (`.\gradlew assembleRelease`), puis EAS groupé

**Règle :** OTA TOUJOURS EN PREMIER. Rebuild seulement si le bug est natif.  
**Quota :** 30 builds EAS Free/mois — cible ≤ 4 builds/mois.

### Méthodologie bugs/crashs (3 étapes)
1. **🎯 Identifier la source :** Crashlytics (crash natif) / Supabase Logs (API) / EF Logs (paiements)
2. **🛠️ Demander les logs exacts** avant de toucher au code
3. **Format de réponse obligatoire :**
   - 🎯 Diagnostic (cause racine)
   - 🛠️ Fichiers modifiés
   - 💻 Code correctif complet
   - 🚀 Commande de vérification

### PostgREST surcharge (erreur PGRST203)
- Ne jamais laisser coexister 2 fonctions PostgreSQL du même nom avec des signatures différentes
- Toujours faire `DROP FUNCTION IF EXISTS ancienne_signature;` avant `CREATE OR REPLACE`

### Storage upload (NE PAS utiliser le client direct)
- **Toujours passer par** : `POST /functions/v1/upload-image` avec headers `x-bucket` et `x-path`
- Le client storage direct retourne `DatabaseInvalidObjectDefinition` (bug schéma NULL sur ce projet)

### SERVICE_ROLE_KEY
- **JAMAIS** dans React Native — uniquement dans les Edge Functions Supabase

---

## 7. PAIEMENTS

### Wave — état actuel
- Clés configurées ✅, signature OK ✅
- **Bloqué** : IP whitelist activée chez Wave (IPs Supabase dynamiques incompatibles)
- **Solution** : Supabase Pro → IP dédiée → Wave dashboard → ajouter l'IP

### Orange Money — état actuel
- Paiements QR clients : **EN PRODUCTION ✅** (deep link + app OM)
- Reversements Cash In prestataires : **EN PRODUCTION ✅** (vérifié 2026-08-09)
  - `OM_RETAILER_MSISDN` configuré (numéro LASSI = 770926843)
  - `OM_RETAILER_PIN_ENCRYPTED` configuré (PIN chiffré RSA)
  - `process-payouts` EF ACTIVE v39, pg_cron toutes les 2 min ✅
  - Secret Vault `lassi_process_payouts_cron_secret` présent ✅ — système complet

### Phrase secrète Wave
Quand tu dis **"Pauline c'est bon"** → Claude doit immédiatement :
1. Ouvrir `Lassi/src/config/features.ts`
2. Mettre `WAVE_ENABLED = true`
3. Mettre `VISIBILITY_PACKS_ENABLED = true`
4. Lancer `eas update --channel production --message "activate Wave + visibility packs"`

### Règle IP Whitelist Wave
**NE JAMAIS rajouter d'IP** dans le portail Wave tant qu'il n'y a pas d'IP statique — le simple ajout réactive immédiatement le filtrage et bloque tout.

---

## 8. GOOGLE PLAY / APP STORE

### Avertissements Play Console déjà traités (version 18)
| Avertissement | Statut |
|---|---|
| API dépréciées edge-to-edge (StatusBar.backgroundColor) | ✅ Corrigé — OTA 2026-08-09 |
| Restrictions orientation (screenOrientation) | ✅ Corrigé — prêt pour rebuild |
| Aucun fichier de désobscurcissement (ProGuard) | ✅ Activé — effectif au prochain build |

### Rejet antérieur
- Motif : compte personnel alors que Google considère LASSI = service financier (Wave/OM)
- Options : appel (LASSI = marketplace pas service financier) ou compte organisation
- LASSI a : NINEA + RCCM → éligible compte organisation

### Politique Play Console
- Compte démo obligatoire avec identifiants → voir section 3
- Politique de confidentialité en ligne → https://lassi.tech/privacy.html ✅

---

## 9. BUILD & DÉPLOIEMENT

### Commandes essentielles
```bash
# OTA (JS uniquement, 0 build EAS)
eas update --channel production --message "fix: description"

# Build natif Android production
eas build --platform android --profile production

# Test local APK (0 quota EAS)
cd Lassi/android && .\gradlew assembleRelease --no-daemon

# Edge Function
supabase functions deploy [nom-function]
```

### Crashlytics
- Entièrement intégré et validé ✅ (crash test effectué 2026-07-28)
- Dashboard Firebase : 90% crash-free, actif en production

### Icône finale validée
- **Source précédente :** `C:\Users\USER\Desktop\LASSI\lassi-icon-FINALsan poi.png` (2020×2020, sans pointillés) — validée sur TECNO physique
- **Nouvelle source (prochain EAS build) :** `C:\Users\USER\Desktop\LASSI\lassi-icon-FINAL 11.png`
  - Logo agrandi : L + aiguille ×1.9 plus grands, crop-zoom CROP=880 sur source 2020×2020
  - Script : `Lassi/scripts/generate-icon.mjs` (Sharp)
  - Régénérer : `Lassi/assets/icon.png` + `Lassi/assets/adaptive-icon.png` + `icon_playstore_512.png`

---

## 10. SYSTÈMES DÉVELOPPÉS

| Système | État | Fichiers clés |
|---|---|---|
| Auth + profils Supabase | ✅ | `src/services/auth.ts`, `src/store/authStore.ts` |
| Avatar unifié | ✅ | `src/components/Avatar.tsx` (20 fichiers utilisateurs) |
| Vitrine adaptative (4 étapes inscription) | ✅ | `MerchantShopSetupScreen.tsx`, `OpeningHoursCard.tsx` |
| Système Avis | ✅ | table `avis` + `RatingPromptModal.tsx` |
| VIP System v2 (pg_cron, anti-triche) | ✅ | `vip_rankings`, `vip_settings`, `vip_run_log` |
| Système Classements (style PUBG) | ✅ Phases 1-9 | `src/screens/classement/ClassementScreen.tsx` |
| Dashboard Admin | ✅ | `lassi-admin/` |
| Paiement Wave/OM | ✅ (bloqué IP) | Edge Functions `create-payment`, `verify-payment` |
| Pack Visibilité | ✅ | `VisibilityScreen.tsx`, `create-visibility-payment` |
| Annonces Sponsorisées | ✅ | `SponsoredAdCard.tsx`, `sponsored_ads` table |
| Notes mutuelles commandes | ✅ | `order_ratings` table, `RatingPromptModal.tsx` |
| Commission 5 Étoiles (2%) | ✅ | VIP commission séparée |
| Réservation Table (restaurants VIP) | ✅ | `src/vip/screens/ReservationFlowScreen.tsx` |
| MapScreen UX | ✅ | bouton fermer, tel/adresse cliquables, compteur pins |
| Crashlytics | ✅ | `@react-native-firebase/crashlytics` + `ErrorBoundary.tsx` |
| Hadama (CRM) + Coumba (Marketing) | ✅ | repos séparés Next.js 15 |

---

## 11. FIXES TECHNIQUES IMPORTANTS À CONNAÎTRE

### GoTrue mutex / spinner infini login
- Cause : GoTrue tient un mutex pendant l'init et tente un refresh réseau (12s)
- Fix : `SessionAwareStorage` (`src/lib/secureStorage.ts`) + clé `SESSION_ACTIVE_KEY` dans AsyncStorage
- Si pas de session active → GoTrue skip le refresh → login instantané

### Upload chat Storage
- NE PAS utiliser `supabase.storage.from('chat-media')` → bug schéma NULL
- Toujours passer par l'Edge Function `upload-image` avec service_role

### OM deep link Android 11+
- `Linking.canOpenURL('orangemoney://')` retourne `false` si scheme non déclaré dans AndroidManifest
- Fix : utiliser `Linking.openURL()` directement sans `canOpenURL`
- Ajouter `<queries>` dans AndroidManifest pour les schemes orangemoney:// et wave://

### deep link scheme
- **Toujours utiliser** `lassiapp://` (PAS `lassi://`)
- Dans Supabase secrets : `APP_BASE_URL=lassiapp://`

---

## 12. RÈGLES DE CODE

- Commentaires en **français**
- Monnaie : `{valeur.toLocaleString('fr-FR')} F` (jamais FCFA)
- Approche "zéro friction" (gérants peu alphabétisés)
- Pas de halos/glows (sauf onde micro VoiceAssistant)
- `SERVICE_ROLE_KEY` jamais côté client
- Paiements : idempotence obligatoire (clé `transaction_id`)
- Chaque `useEffect` avec souscription DOIT retourner une fonction cleanup

---

## 14. CHECKLIST PROCHAIN EAS BUILD

> Chaque fois que tu dis **"prochain build"**, Claude sort cette liste et l'applique AVANT de lancer `eas build`.

### Changements déjà préparés dans le code (à vérifier appliqués)

| Changement | Fichier | Statut |
|---|---|---|
| Splash seamless (assets déjà dans le repo) | `app.config.js` → `expo-splash-screen` plugin | ⏳ Prêt — inclure au build |
| **Icône agrandie** : L + aiguille ×1.9 plus grands (crop-zoom source 2020×2020, CROP=880) — `assets/icon.png` + `assets/adaptive-icon.png` déjà régénérés | `scripts/generate-icon.mjs` (Sharp) | ⏳ Prêt — nécessite rebuild natif (ne passe PAS en OTA) |

### Commande de build
```bash
eas build --platform android --profile production
```

---

## 15. FLUX PAIEMENT OM — RÈGLES IMMUABLES (2026-08-10)

> **Lire cette section AVANT toute migration touchant `orders`, `payment_intents`, `payout_queue`, ou les Edge Functions `create-payment`, `verify-payment`, `process-payouts`.**

### Flux complet (6 étapes)
1. `create-order` EF → `create_order_atomic` → `orders.status = 'pending'` (Wave/OM) ou `'new'` (cash)
2. `create-payment` EF → `initiate_order_payment` → accepte **UNIQUEMENT** `status IN ('new', 'pending')`
3. Client paie dans l'app OM (QR code deeplink)
4. Webhook OM → `process_payment_webhook` → `confirm_order_from_payment` → `status = 'split_done'` + INSERT `payout_queue`
5. `verify-payment` EF → poll API OM si nécessaire
6. pg_cron toutes les 2 min → `process-payouts` EF → Cash In OM → `payout_queue.statut = 'paid'`

### Commissions
| Type | LASSI | OM collecte | OM Cash In | Net prestataire |
|---|---|---|---|---|
| Standard | 1% | 1% | 0.8% | ~98% prix_base |
| 5 Étoiles | 2% | 1% | 0.8% | ~98% prix_base |

### RÈGLE 1 — Statut initial commande
- Wave/OM → `status = 'pending'` (invisible prestataire jusqu'au paiement)
- `initiate_order_payment` doit TOUJOURS accepter `status NOT IN ('new', 'pending')` → erreur
- **Bug corrigé 10/08/2026** : la migration 20260808020000 avait changé le statut initial à `'pending'` mais `initiate_order_payment` vérifiait encore `<> 'new'` → bloquait tous les paiements. Fix : migration `20260810000000`.

### RÈGLE 2 — Contrainte CHECK orders.status
Toujours inclure `'pending'` dans la contrainte :
```sql
CHECK (status IN ('pending', 'new', 'preparing', 'ready', 'done', 'refused'))
```

### RÈGLE 3 — CRON_SECRET : synchronisation OBLIGATOIRE dans 3 endroits
```
1. supabase secrets set CRON_SECRET=<valeur>
2. SQL cron.schedule(...) hardcodé dans le header X-Cron-Secret
3. Vault Supabase → lassi_process_payouts_cron_secret
```
**Symptôme de désync :** `payout_queue.statut='queued'` + `attempts=0` après 15+ minutes.  
**Valeur actuelle (2026-08-10) :** `sv8axdvVnjZRJE/AvU6W2IKTSKXwKUNHhYJoYSKlRPA=`  
⚠️ Si tu fais `supabase secrets set` sans inclure CRON_SECRET → la valeur est vidée → payouts bloqués.

### RÈGLE 4 — confirm_order_from_payment doit TOUJOURS
1. Mettre `payment_intents.statut = 'split_done'`
2. Mettre `orders.status = 'new'` (prestataire voit la commande)
3. Insérer dans `payout_queue` avec montant net

### RÈGLE 5 — Idempotence webhook
`external_event_id` UNIQUE dans `payment_logs` — NE JAMAIS supprimer cette contrainte.

---

## 16. NOTIFICATIONS PRESTATAIRE APRÈS REVERSEMENT — RÈGLES IMMUABLES (2026-08-10)

> **Lire avant toute modif de `process-payouts/index.ts` ou de la table `notifications`.**

### Architecture
- **Push (bannière)** : `sendPushToUser` → `push_tokens` → Expo Push API
- **In-app** : INSERT dans `notifications` (user_id, type='payment', title, body, data)
- La notification ne part **QUE** après `payout_queue_mark_paid` retourne `ok: true`

### Types de message
| Cas | Détection | Titre |
|---|---|---|
| Abonnement fitness | `payment_intents.metadata.offre_nom` non null | `Nouvel abonné payé` |
| Commande classique | fallback | `Reversement reçu` |

### RÈGLE N1 — Jamais de `catch {}` silencieux
`catch {}` masque toutes les erreurs sans aucun log → impossible à diagnostiquer.  
**Toujours logger :** `console.error('[notif] ...', e instanceof Error ? e.message : e)`  
**Bug corrigé 10/08/2026** : catch silencieux cachait une erreur → zéro notification en prod.

### RÈGLE N2 — `.catch(() => null)` sur Supabase ne catch PAS les erreurs PostgREST
Supabase JS v2 ne throw jamais — il retourne `{ data, error }`. Toujours vérifier `error` :
```typescript
const { error: notifErr } = await supabase.from('notifications').insert({...});
if (notifErr) console.error('[notif] insert erreur:', notifErr.message);
```

### RÈGLE N3 — Contrainte type de la table notifications
Types valides : `'order', 'payment', 'vip', 'message', 'debt', 'livraison', 'ann'`  
Utiliser `type: 'payment'` pour les reversements.  
Si tu ajoutes un type → mettre à jour la contrainte CHECK sinon l'insert échoue silencieusement.

### RÈGLE N4 — Cron boot/shutdown sans logs `[notif]` = normal
Signifie juste qu'il n'y a aucun payout en queue. Pour tester : faire un NOUVEAU paiement. Les anciens payouts déjà en statut `paid` ne repassent jamais.

---

## 17. SPORT/FITNESS — GESTION SPÉCIALE CLASSEMENTS & RECETTE (2026-08-10)

> **Pour les prestataires sport/salle de sport** : leurs revenus viennent des abonnements (`fitness_abonnements_clients`), pas des `orders`. Lire avant toute migration touchant `classements` ou `MerchantDashboard.tsx`.

### Architecture

| Aspect | Source de données |
|---|---|
| Recette du jour | `payout_queue.montant` WHERE `statut='paid'` + `processed_at >= aujourd'hui` + `payment_intents.metadata->>'offre_nom' IS NOT NULL` |
| Classements semaine | UNION ALL orders + fitness_abonnements_clients dans `cmds_brutes` |
| Classements mois | Idem — mondial + quartier + clients |
| RPC mobile | `get_daily_fitness_earnings(p_prestataire_id)` → `{ revenue, count }` |

### Règles IMMUABLES — Table classements

1. **PAS de colonne `updated_at`** dans `classements`. Ne jamais l'inclure dans un INSERT.
   - Bug corrigé 10/08/2026 : migration échouée avec `column "updated_at" does not exist`
   - Référence correcte : migration `20260731040000_fix_classement_merchant_id.sql`

2. **`prestataire_id = shops.merchant_id`** (= `profiles.id`), **JAMAIS `shops.id`**
   - `shops.id` = UUID technique de la boutique
   - `shops.merchant_id` = UUID de l'utilisateur (lié à `profiles.id`)

3. **Format INSERT correct :**
   ```sql
   INSERT INTO classements
     (type, sous_categorie, periode, rang, points, nom_affiche, image_url, prestataire_id, est_actif)
   ```

4. **JOIN fitness → shops :** `JOIN shops s ON s.merchant_id = fac.prestataire_id`
   - `fitness_abonnements_clients.prestataire_id` = UUID profil (= `shops.merchant_id`)

### Recette du jour (MerchantDashboard)

- **Recette normale** = `orders[status='done'].total` (calcul local via ordersStore)
- **Recette fitness** = `get_daily_fitness_earnings` RPC → montant réel reversé par LASSI
- **Total affiché** = `normalEarnings + fitnessRevenue`
- ⚠️ On affiche le montant REVERSÉ (après commission + frais OM), pas le prix payé par le client

### Anti-triche classements

- Max 5 abonnements du même client comptés par semaine pour un même shop
- Max 20 par mois
- Implémenté via `ROW_NUMBER() OVER (PARTITION BY shop_id, client_id)`

---

## 18. FLUX PAIEMENT VISIBILITÉ (OM) — RÈGLES IMMUABLES (2026-08-10)

> **Lire avant toute migration touchant `visibility_subscriptions`, `create-visibility-payment`, `verify-visibility-payment`, `SponsoredAdPanel.tsx`, `VisibilityScreen.tsx`, `PayFooter.tsx`.**

### Architecture complète — 3 options

| Option | offerType | Géré par |
|---|---|---|
| Annonce sponsorisée | `'annonce'` | `SponsoredAdPanel.tsx` → `launchWithWaveOrOM()` |
| Offre du quartier | `'quartier'` | `VisibilityScreen.tsx` → `handlePay()` |
| Booster position | `'recherche'` | `VisibilityScreen.tsx` → `handlePay()` |

**Toutes les 3 options passent par la même Edge Function** : `create-visibility-payment`

### Flux OM complet (6 étapes)

1. **Prestataire choisit OM + clique "Lancer"**
2. **`create-visibility-payment` (POST)** → crée `visibility_subscriptions` en `status='pending'` → appelle OM API `/api/eWallet/v4/qrcode` → retourne `{ paymentUrl, qrCode, subscriptionId }`
3. **App ouvre l'app OM** : `Linking.openURL(paymentUrl)` — PAS `canOpenURL` avant (bloque Android 11+)
4. **Prestataire paie dans app OM** (hors LASSI)
5. **Webhook OM** → `verify-visibility-payment?sub_id=...&secret=...` → active `visibility_subscriptions.status='active'`
6. **Prestataire clique "J'ai payé — vérifier"** → LASSI lit `visibility_subscriptions.status` en DB

### RÈGLE V1 — NE JAMAIS utiliser `Linking.canOpenURL()` avant `openURL()`
`canOpenURL` retourne `false` sur Android 11+ pour tout scheme custom non déclaré dans AndroidManifest.
L'app OM utilise un scheme type `orange-money://` non déclaré → `canOpenURL` = `false` → OM ne s'ouvrait jamais.

**Pattern CORRECT :**
```typescript
if (result.paymentUrl) {
  Linking.openURL(result.paymentUrl).catch(() => {
    // Silencieux — le QR code sert de fallback
  });
}
```

**Pattern INTERDIT :**
```typescript
const canOpen = await Linking.canOpenURL(url);
if (canOpen) Linking.openURL(url);  // ← BLOQUE TOUJOURS SUR ANDROID 11+
```

### RÈGLE V2 — QR code = toujours visible si disponible
Le QR code OM doit s'afficher **dès que `result.qrCode` est non-vide**, indépendamment de `paymentUrl`.
Ne PAS conditionner `showQr = !!qrCode && !paymentUrl` — cette logique masque le QR quand deepLink échoue silencieusement.

**Pattern CORRECT :**
```typescript
{!!qrCode && <Image source={{ uri: `data:image/png;base64,${qrCode}` }} />}
```

### RÈGLE V3 — Wave masqué jusqu'à IP statique
`WAVE_ENABLED = false` dans `src/config/features.ts`.
**Les 3 panneaux de paiement doivent importer et respecter ce flag :**
- `PayFooter.tsx` ✅ — utilise `{WAVE_ENABLED && (...Wave...)}`
- `SponsoredAdPanel.tsx` ✅ — idem depuis 10/08/2026
- Si tu ajoutes un 4ème panneau → importer `WAVE_ENABLED` et entourer le bloc Wave

**Pour réactiver Wave :** `WAVE_ENABLED = true` dans `features.ts` + `eas update --channel production`

### RÈGLE V4 — `OM_WEBHOOK_SECRET` est obligatoire dans l'EF
Si `OM_WEBHOOK_SECRET` est absent → l'EF lance une exception avant l'appel OM API.
Ne jamais supprimer ce secret ni le rendre optionnel dans `create-visibility-payment`.

### RÈGLE V5 — `visibility_subscriptions` : un seul abonnement actif "quartier"
L'EF vérifie qu'il n'existe pas d'abonnement `quartier` actif avant d'en créer un nouveau → retourne 409.
Ne jamais supprimer cette vérification (risque de double facturation).

### RÈGLE V6 — `plan_id = null` pour les annonces
L'`offerType = 'annonce'` n't a pas de ligne dans `visibility_plans` → `plan_id = null` dans l'INSERT pour éviter la FK violation.
Si tu ajoutes une table liée à `visibility_subscriptions.plan_id` → pense à gérer le `null`.

### RÈGLE V7 — Webhook OM : URL avec `sub_id` + `secret` en query params
```
${SUPABASE_URL}/functions/v1/verify-visibility-payment?sub_id=<uuid>&secret=<OM_WEBHOOK_SECRET>
```
**Ne jamais changer cette structure d'URL** sans mettre à jour simultanément `verify-visibility-payment` qui lit ces params.

### RÈGLE V8 — Vérification du paiement = lecture DB, pas appel EF
`verifyVisibilityPayment(subscriptionId)` lit directement `visibility_subscriptions.status` dans Supabase.
**Ne pas créer une Edge Function de vérification** — le webhook OM active déjà le statut côté serveur.

### Ce qu'il NE faut PAS toucher sans plan
| Fichier | Risque si modifié |
|---|---|
| `verify-visibility-payment/index.ts` | Change la validation du secret → webhook OM rejeté |
| `create-visibility-payment/index.ts` | Change le format body OM → QR non créé |
| `visibility_subscriptions` table | Change les colonnes `status`, `offer_type`, `plan_id` → EF crash |
| `OM_WEBHOOK_SECRET` (secret EF) | Si vidé → toutes les confirmations OM bloquées |

---

## 14. CHECKLIST PROCHAIN EAS BUILD — SCAN MENU (feature-scan-menu)

**Date d'ajout :** 2026-08-12  
**Branche :** `feature-scan-menu` (9 commits depuis `feature/fitness-abonnements`)

### ⚡ ACTION OBLIGATOIRE AU PROCHAIN BUILD

`@react-native-ml-kit/text-recognition` est un **module natif JNI Android**.  
Il ne peut PAS s'activer par OTA update. Le build actuel en production ne le contient pas.

```bash
# Merger feature-scan-menu dans la branche de base, puis :
eas build --profile production --platform android
```

L'autolinking Expo (`expo-autolinking-settings`) inclura ML Kit automatiquement — **pas de gradle manuel**.

### Fichiers créés (feature-scan-menu)

| Fichier | Rôle |
|---|---|
| `src/utils/parsingMenu.ts` | Parser OCR : ProduitExtrait, confiance, plafond 40 items |
| `src/components/store/ScanMenuCamera.tsx` | Modal caméra/galerie + OCR ML Kit |
| `src/components/prestataire/ScannerMenu.tsx` | Card embarquable avec photo preview |
| `src/screens/merchant/RelectureMenuScreen.tsx` | Écran relecture + publication (FlatList éditable) |
| `src/services/produitsService.ts` | Création masse sans store Zustand (résout shopId auto) |

### Fichiers modifiés clés

- `src/screens/merchant/StoreScreen.tsx` — ScannerMenu card (onboarding vide) + AddMethodPicker "📷 Scanner mon menu"
- `src/screens/merchant/MerchantNavigator.tsx` — type `relecture_menu` + render + prop `onRelectureMenu`
- `src/components/store/AddProductSheet.tsx` — prop `prefill` optionnel (nom/prix/desc)
- `app.config.js` — permissions caméra + galerie mentionnent le scan menu

### Garde-fous en place
- ML Kit on-device → zéro serveur, zéro coût API, fonctionne hors-ligne
- Relecture humaine obligatoire (RelectureMenuScreen) avant toute publication
- Prix filtré 50–200 000 FCFA (filtre numéros de téléphone)
- Badge ⚠️ sur items à faible confiance OCR
- Plafond 40 items par scan (tri haute→basse confiance)

---

## 13. POUR AJOUTER UNE MÉMOIRE

Dis à Claude : **"mémorise que [information]"** ou **"souviens-toi de [information]"**  
Claude ajoutera le bloc dans la section appropriée de ce fichier.

---

*Dernière mise à jour : 2026-08-10*
