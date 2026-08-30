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
| **🔔 PUSH iOS** : credentials APNs configurés dans EAS (clé `8B2UX9XA8J`, team `8DH7238995`) — le binaire aura `aps-environment:production` signé → tokens iOS fonctionnels | Automatique via EAS — aucune action code requise | ⏳ Build seul corrige le bug |

### Après le build iOS — vérifier push
1. Installer TestFlight, ouvrir l'app 30s
2. Vérifier `push_log` (Supabase Dashboard → Table Editor) → `status='token_saved'` doit apparaître
3. Si `device_token_error` toujours présent → voir **Section 20** pour diagnostic

### Commande de build
```bash
eas build --platform ios --profile production
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

---

## 19. MÉTHODOLOGIE PAIEMENTS — DÉMARCHE UNIVERSELLE OM → WAVE (2026-08-21)

> **Section de référence.** Quand on fait Wave, lire ici d'abord. Même consignes, même résultat attendu — seul l'API change.

---

### 19.1 Vue d'ensemble — ce qu'on a fait pour OM sur chaque catégorie

| Catégorie | EF création | Table créée | Webhook | Reversement |
|---|---|---|---|---|
| Commandes simples | `create-payment` | `payment_intents` | `webhook-payment` | `process-payouts` (payout_queue) |
| Abonnements fitness | `create-fitness-payment` | `fitness_abonnements_clients` | `webhook-payment` | `process-payouts` (payout_queue) |
| Terrains | `create-terrain-payment` | `reservations_terrain` | `verify-terrain-payment` + `webhook-payment` | `terrainPayout.ts` |
| Pack visibilité | `create-visibility-payment` | `visibility_subscriptions` | `verify-visibility-payment` | Aucun (LASSI garde) |

---

### 19.2 La démarche identique pour chaque catégorie (OM)

**ÉTAPE 1 — Edge Function création (backend)**
- Reçoit le montant + identifiants (clientId, prestataireId, typeService)
- Calcule commission LASSI (1% standard, 2% VIP)
- Crée un enregistrement en statut **pending/en_attente** dans la table cible
- Appelle l'API OM : `POST /api/eWallet/v4/qrcode` avec `amount`, `orderId`, `notifUrl`
- Retourne `{ paymentUrl, qrCode, [entitéId] }` à l'app

**ÉTAPE 2 — App mobile (frontend)**
- Affiche le QR code dès que `result.qrCode` est non-vide (**toujours**, fallback garanti)
- Ouvre l'app OM : `Linking.openURL(result.paymentUrl)` — **sans `canOpenURL` avant** (Android 11+ bug)
- Affiche un bouton "J'ai payé — vérifier" pour déclencher la vérification manuelle
- Ne jamais bloquer sur le deeplink : le QR code est toujours le fallback

**ÉTAPE 3 — Webhook OM (backend)**
- OM appelle `notifUrl` après paiement
- L'EF vérifie le `secret` dans les query params (protection)
- Idempotence : `external_event_id` UNIQUE dans `payment_logs` — ignore les doublons
- Confirme l'enregistrement (`status = 'active'` / `statut = 'confirme'` / `status = 'new'`)
- Insère dans `payout_queue` si c'est un flux avec reversement au prestataire

**ÉTAPE 4 — Reversement au prestataire (backend)**
- `process-payouts` (pg_cron toutes les 2 min) → lit `payout_queue` → Cash In OM
- Notification push + in-app après reversement réussi
- `payout_queue.statut = 'paid'` après succès

**ÉTAPE 5 — Vérification depuis l'app**
- `verifyPayment(id)` → lit directement la DB (pas une EF) — le webhook a déjà fait le travail
- Affiche le résultat à l'utilisateur

---

### 19.3 Les invariants qui ne changent JAMAIS (OM ou Wave)

| Invariant | Règle |
|---|---|
| **Idempotence** | `external_event_id` UNIQUE dans `payment_logs`. Jamais supprimer cette contrainte. |
| **Pending d'abord** | Toujours créer l'enregistrement en statut pending AVANT d'appeler l'API paiement |
| **QR visible toujours** | Afficher le QR code indépendamment du deeplink — jamais conditionner à l'absence de paymentUrl |
| **Pas de `canOpenURL`** | `Linking.openURL()` direct — `canOpenURL` bloque Android 11+ pour les schemes custom |
| **WAVE_ENABLED flag** | Toutes les UIs de paiement doivent vérifier ce flag avant d'afficher Wave |
| **SERVICE_ROLE_KEY** | Jamais dans React Native. Uniquement dans les Edge Functions. |
| **Notification catch** | Jamais `catch {}` silencieux sur les notifications — logger toujours l'erreur |
| **CRON_SECRET sync** | 3 endroits simultanément : `supabase secrets set`, SQL cron header, Vault Supabase |
| **Notifications type** | Vérifier la contrainte CHECK sur `notifications.type` avant d'ajouter un nouveau type |
| **Deeplink scheme** | Toujours `lassiapp://` dans APP_BASE_URL — jamais `lassi://` |

---

### 19.4 Ce qu'on change pour Wave (même consignes, API différente)

**Différences API Wave vs OM :**

| Aspect | Orange Money | Wave |
|---|---|---|
| Endpoint paiement | `POST /api/eWallet/v4/qrcode` | `POST /v1/checkout/sessions` |
| Ce que retourne l'API | `{ paymentUrl, qrCode }` | `{ wave_launch_url }` |
| QR code intégré | Oui (base64 PNG) | Non — Wave ouvre son propre checkout dans le browser |
| Deeplink | `orangemoney://` (QR + deeplink) | URL Wave dans le browser natif |
| Authentification | Token Bearer OM (rotation) | `Authorization: Bearer ${WAVE_API_KEY}` (clé statique) |
| Webhook confirmation | `notifUrl` dans le body | URL configurée dans le portail Wave |
| Request signing | Non requis | Requis (HMAC signature sur chaque requête) |
| Reversement | Cash In API OM | `POST /v1/payout` (Wave Business Payout API) |
| IP whitelist | Non | Désactivée ✅ — Wave team a désactivé le filtrage 2026-08-24 |
| Status actuel | ✅ PROD | ✅ PROD (2026-08-24) |

**IMPORTANT — success_url / error_url Wave :**
Wave n'accepte QUE `https://` pour ces URLs (pas `lassiapp://`). Mécanisme :
```
success_url: `${SUPABASE_URL}/functions/v1/webhook-payment?r=${encodeURIComponent('lassiapp://...')}`
```
Le GET handler de webhook-payment redirige vers le deep link. Testé ✅ prod 2026-08-24.

**Pour chaque catégorie (commandes, fitness, terrain, visibilité) — démarche Wave :**
1. EF `create-[categorie]-payment` : POST /v1/checkout/sessions via `callWaveCheckout` dans `_shared/waveProxy.ts`
2. L'app reçoit `wave_launch_url` → `Linking.openURL(url).catch(...)` (PAS `canOpenURL` — bloque Android 11+)
3. Wave GET-redirige vers `webhook-payment?r=lassiapp://...` → deep link app
4. App appelle `verify-[categorie]-payment` → `getWaveCheckout(reference)` pour confirmer
5. Reversement Wave : `waveRequestPayout(body, idempotencyKey)` → `POST /v1/payout`
6. Vérifier `WAVE_ENABLED` dans `features.ts` avant toute UI Wave

**Ce qui ne change pas pour Wave :**
- Structure `payment_intents` / `payout_queue` / tables métier
- Logique de commission (1% / 2%)
- Statuts (`pending` → `confirme` → payout)
- Notifications push + in-app
- Idempotence webhook
- Bouton "J'ai payé — vérifier"
- CRON_SECRET sync sur 3 endroits

---

### 19.5 Checklist pour intégrer Wave sur une nouvelle catégorie

```
[ ] 1. Créer EF `create-[categorie]-wave-payment`
        → POST /v1/checkout/sessions avec wave_launch_url_lifetime_secs + success_url
        → success_url = APP_BASE_URL/payment/success?type=[categorie]&id=[entiteId]
[ ] 2. Enregistrement pending en DB AVANT l'appel Wave (même patron OM)
[ ] 3. Ajouter request signing HMAC sur chaque requête Wave (clé WAVE_SECRET_KEY)
[ ] 4. App : Linking.openURL(wave_launch_url) — vérifier WAVE_ENABLED avant
[ ] 5. Webhook Wave (ou redirect) → confirme en DB + insère payout_queue si applicable
[ ] 6. Reversement : /v1/b2c/transfer-money — IP whitelist requise (Supabase Pro)
[ ] 7. Notification push + in-app après reversement
[ ] 8. Vérification depuis l'app = lecture DB directe (pas EF)
[ ] 9. Test complet : paiement → webhook → reversement → notification
[ ] 10. Activer : WAVE_ENABLED = true dans features.ts + eas update prod
```

---

### 19.6 Activation Wave — DÉJÀ EFFECTUÉE (2026-08-24)

**Activation déjà faite :**
- `WAVE_ENABLED = true` ✅ dans `features.ts`
- IP whitelist désactivée par Wave team (email à `prm@wave.com`) ✅
- Tous les secrets configurés : `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` ✅
- OTA déployé production ✅

**Historique phrase secrète :**
- "Pauline c'est bon" reçu 2026-08-24 → activation immédiate effectuée

**Si Wave se remet à bloquer :**
→ Vérifier les logs EF pour `ip-not-allowed` → recontacter `prm@wave.com` pour désactiver le filtrage IP

---

### 19.7 Terrain — flux complet et correctifs validés prod (2026-08-22)

> Cette section documente tout ce qu'on a fait pour OM sur la catégorie **Terrain** (basket/football).  
> Quand on activera Wave → dupliquer chaque point en remplaçant l'API OM par Wave.

---

#### A. Architecture EF terrain (3 Edge Functions, pas 2)

Les terrains ont un flux différent des commandes/fitness car le prestataire doit **valider physiquement** via QR.

| EF | Rôle | Appelé par |
|---|---|---|
| `create-terrain-payment` | Crée réservation `en_attente` → appelle OM QR API → retourne `{ reference, paymentUrl, qrCode }` | App mobile (client clique "Payer") |
| `verify-terrain-payment` | Vérifie auprès de l'API OM si le paiement est passé → si oui, met `statut = 'paye'`, génère `receipt_code`, déclenche reversement | App mobile (client clique "J'ai payé — Vérifier") + Webhook OM |
| `validate-terrain-receipt` | Prestataire scanne le QR client → RPC `verify_terrain_receipt` → pose `validated_at` → envoie notif client | App mobile (prestataire) |

**Différence clé vs commandes/fitness :** `verify-terrain-payment` fait office à la fois de vérification manuelle ET de webhook handler. L'idempotence est assurée par la vérification `statut = 'paye'` en DB avant tout appel OM.

---

#### B. Idempotence dans `verify-terrain-payment`

```typescript
// 1. Vérifier DB d'abord — si déjà payé, retourner immédiatement
if (resaCheck.statut === 'paye') {
  return json({ paid: true, receipt_code: resaCheck.receipt_code });
}
// 2. Seulement ensuite appeler l'API OM
```

**Règle :** Ce pattern s'applique à TOUTES les EF de vérification Wave aussi. Jamais appeler l'API opérateur si la DB dit déjà confirmé.

---

#### C. Retry côté app (nouveau invariant validé en prod)

**Problème :** Le client clique "J'ai payé — Vérifier" avant que l'API OM ait enregistré le paiement → `paid: false` → alerte trop tôt.

**Fix appliqué dans `TerrainPaymentScreen.handleVerify` :**
```typescript
const MAX_ATTEMPTS = 3;
for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  if (attempt > 0) await new Promise<void>(r => setTimeout(r, 3000));
  const result = await verifyTerrainPaymentById(...);
  if (result.paid) { onSuccess(result.receiptCode ?? ''); return; }
}
// Afficher l'alerte seulement après 3 échecs (~9s)
Alert.alert('Paiement non confirmé', '...');
```

**À appliquer pour Wave identiquement.** Wave peut aussi avoir un délai entre le paiement et la confirmation API.

---

#### D. Type de notification `reservation_terrain` — exclusion du modal bloquant

**Problème :** La notification de validation QR (`type: 'reservation_terrain'`) ouvrait un modal plein écran qui bloquait l'utilisateur.

**Fix dans `NotifCardModal.tsx` ligne 70 :**
```typescript
if (!current || current.type === 'order' || current.type === 'msg'
    || current.type === 'ann' || current.type === 'reservation_terrain') return null;
```

**Règle :** Tout nouveau type de notification terrain/fitness doit être ajouté à cette liste pour éviter le modal bloquant. Les seuls types qui méritent le modal plein écran : `vip`, `pay`, `fitness`, `livraison`.

---

#### E. Scoring classement — architecture directe SQL, PAS de trigger

**Problème initial :** On a créé un trigger `trg_reservations_terrain_scoring` qui appelait `ajouter_points_commande()`. Cette fonction n'existe PAS dans le schéma.

**Vraie solution (migration `20260822010000`) :** Le scoring terrain se fait directement dans les CTEs des fonctions classement via un `SELECT` sur `reservations_terrain` — pas besoin de trigger. Trigger **supprimé** en prod.

```sql
-- SUPPRIMER ce trigger (appelle une fonction inexistante) :
DROP TRIGGER IF EXISTS trg_reservations_terrain_scoring ON reservations_terrain;
DROP FUNCTION IF EXISTS trg_scoring_terrain_valide();

-- À la place, les fonctions calcul_classements_semaine/mois ont un CTE :
cmds_terrain AS (
  SELECT s.id AS shop_id, rt.client_id
  FROM reservations_terrain rt
  JOIN shops s ON s.merchant_id = rt.prestataire_id
  WHERE rt.statut IN ('paye', 'utilise')   -- ← INCLUT les réservations validées QR
    AND rt.created_at >= v_week_start AND rt.created_at < v_week_end
)
```

**Règle CRITIQUE :** `statut IN ('paye', 'utilise')` — JAMAIS `statut = 'paye'` seul. Après scan QR, le statut passe à `'utilise'`. Si on filtre uniquement `'paye'`, les réservations validées disparaissent du scoring → score figé pour tous les terrains.

**Règle :** Cette architecture directe (CTE dans les fonctions) s'applique à tous les nouveaux types de service. Wave ne change rien — même CTEs, même logique.

---

#### F. Multi-terrains — sélecteur côté client

**Problème :** Quand un prestataire a plusieurs terrains, `ShopScreen.tsx` affichait uniquement `terrains[0]` (hardcodé).

**Fix — `ShopScreen.tsx` :**
```tsx
const [selectedTerrainIdx, setSelectedTerrainIdx] = useState(0);
// ...
{terrains.length > 1 && (
  <View style={styles.slotTerrainPicker}>
    {terrains.map((t, i) => (
      <TouchableOpacity key={t.id} onPress={() => setSelectedTerrainIdx(i)}>
        <Text>{SPORT_EMOJI[t.sport_type]} {t.nom}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
<ShopTerrainSlotPicker terrain={terrains[selectedTerrainIdx] ?? terrains[0]} ... />
```

**Règle :** `getTerrainsByMerchant` retourne tous les terrains du prestataire (sans filtre `actif`). Le client ne voit que ceux avec `actif = true` via RLS. L'UI doit gérer le cas N terrains.

---

#### G. RLS terrains (rappel)

```sql
"terrains_public_read"       : FOR SELECT USING (actif = true)         -- clients
"terrains_prestataire_manage": FOR ALL    USING (auth.uid() = prestataire_id)  -- propriétaire
```

`prestataire_id` sur la table `terrains` = `profiles.id` (pas `shops.id`). Important pour les triggers scoring.

---

#### H. NotifPopupBanner slide-top pour terrain (2026-08-22) ✅

**Ce qu'on a fait :** En plus de la notification push classique, les terrains déclenchent maintenant la bannière slide-top (comme "À la une").

**Fichiers modifiés :**
- `NotifPopupBanner.tsx` — ajout type `reservation_terrain` dans `COLOR`, `BG`, condition d'affichage, bouton "Voir", handler `handleTerrainAction` avec prop `onVoirTerrain`
- `MerchantNavigator.tsx` → `shouldShowCard` : ajouter `|| type === 'reservation_terrain'`
- `HomeNavigator.tsx` → `shouldShowCard` : idem
- `App.tsx` → `<NotifPopupBanner onVoirTerrain={(terrainId) => setPendingNav({ type: 'terrain_resa', terrainId })} />`

**Quand :**
1. LASSI reverse au prestataire (étape 5 du flux) → bannière prestataire : "Nouvelle réservation à valider"
2. Prestataire valide QR (étape 6 du flux) → bannière client : "Réservation confirmée"

**Règle :** Pour tout nouveau type de notification (`type='xxx'`), ajouter dans ces 4 endroits + dans la contrainte CHECK de `notifications.type`.

---

#### I. Classements live-first (correctif 2026-08-22) ✅

**Problème :** `ClassementScreen.tsx` lisait le snapshot DB en premier. Si une migration force un recalcul mi-semaine, le snapshot est créé et devient la source → scores figés même après nouveaux achats.

**Fix dans `ClassementScreen.tsx` :**
```typescript
// AVANT (snapshot-first → fige les scores après migration mi-semaine)
data = await getClassementSousCategorie(classeKey, getPeriodeSemaine());
if (data.length === 0) data = await getClassementLiveSousCategorie(classeKey);

// APRÈS (live-first → toujours frais)
data = await getClassementLiveSousCategorie(classeKey);
if (data.length === 0) data = await getClassementSousCategorie(classeKey, getPeriodeSemaine());
```

**Appliqué sur :** "Ma catégorie" (hebdo) ET "National" (mensuel). "Mon quartier" était déjà live-first.

**Règle :** Les snapshots servent uniquement d'archive et de fallback de secours. Ne jamais les mettre en lecture primaire pour l'affichage temps réel.

---

#### J. Checklist Wave pour la catégorie Terrain — ✅ COMPLÈTE (2026-08-24)

```
[✅] 1. create-terrain-payment → callWaveCheckout(waveBody, reservationId)
        → success_url = webhook-payment?r=lassiapp://terrain/paiement/succes?r={reservationId}
        → error_url   = webhook-payment?r=lassiapp://terrain/paiement/echec?r={reservationId}
[✅] 2. TerrainPaymentScreen : Linking.openURL(session.paymentUrl) direct (pas canOpenURL)
        → Bouton "J'ai payé — Vérifier" présent
[✅] 3. verify-terrain-payment : getWaveCheckout(reference) → payment_status === 'succeeded'
        → Déclenche triggerTerrainPayout(WAVE_API_KEY) après confirmation
[✅] 4. Webhook Wave → GET redirect → deep link → app appelle verify-terrain-payment
[✅] 5. Reversement Wave : waveRequestPayout via _shared/waveProxy.ts → POST /v1/payout
        → terrainPayout.ts : condition params.moyenPaiement === 'wave' && params.WAVE_API_KEY
[✅] 6. WAVE_ENABLED vérifié dans TerrainPaymentScreen (ligne 19, 160)
[✅] 7. Notifications reservation_terrain : bannière + push + in-app
[✅] 8. Scoring : indépendant du moyen de paiement
[✅] 9. Multi-terrains : sélecteur déjà en place
[✅] 10. Classements live-first déjà en place
[ ] 11. Test complet en production : payer Wave → verify → receipt_code → QR scan prestataire
```

---

### 19.8 Wave — INTÉGRATION COMPLÈTE (2026-08-24) ✅

> Tout ce qui a été fait pour activer Wave en production sur toutes les catégories.

**Problèmes résolus :**
| Problème | Solution |
|---|---|
| `ip-not-allowed` IP bloquée | Email prm@wave.com → filtrage IP désactivé par Wave team |
| `request-validation-error` lassiapp:// refusé | Redirect HTTPS via `webhook-payment?r=encodeURIComponent(lassiapp://...)` |
| `supabaseUrl is not defined` scope | Remplacé par `Deno.env.get('SUPABASE_URL')` inline |
| `canOpenURL` bloque Android 11+ | `Linking.openURL(url).catch(...)` direct dans CheckoutPayment.tsx |

**Architecture finale `_shared/waveProxy.ts` :**
- `callWaveCheckout(body, idempKey)` → POST /v1/checkout/sessions
- `getWaveCheckout(sessionId)` → GET /v1/checkout/sessions/{id}
- `waveRequestPayout(body, idempKey)` → POST /v1/payout
- `waveRequestRefund(sessionId, body, idempKey)` → POST /v1/checkout/sessions/{id}/refund
- Routage automatique via `WAVE_PROXY_URL` si configuré (optionnel)

**Fonctions déployées 2026-08-24 :**
create-payment, create-terrain-payment, create-fitness-abonnement-payment,
create-livraison-payment, create-table-reservation, create-visibility-payment,
webhook-payment, verify-terrain-payment, verify-fitness-payment,
verify-livraison-payment, process-payouts, refund, create-vip-order, process-table-reservation

**Statut par catégorie :**
| Catégorie | EF Create | Verify | Payout | Testé |
|---|---|---|---|---|
| Commandes | ✅ | ✅ (via webhook) | ✅ process-payouts | ✅ prod 2026-08-24 |
| Terrain | ✅ | ✅ verify-terrain | ✅ terrainPayout | ⏳ à tester |
| Fitness | ✅ | ✅ verify-fitness | ✅ process-payouts | ⏳ à tester |
| Livraison | ✅ | ✅ verify-livraison | N/A | ⏳ à tester |
| Résa Table | ✅ | ✅ (via webhook) | ✅ après accept gérant | ⏳ à tester |
| Visibilité | ✅ | ✅ (via webhook) | N/A | ⏳ à tester |

---

## 20. PUSH NOTIFICATIONS — ÉTAT COMPLET & CHECKLIST BUILD (2026-08-23)

> **Lire AVANT tout rebuild iOS/Android.** Tout ce qui a été configuré le 23/08/2026 pour que les notifs push arrivent sur écran verrouillé.

---

### 20.1 Architecture push LASSI (2 couches)

| Couche | Mécanisme | État |
|--------|-----------|------|
| **In-app** | Supabase Realtime WebSocket → `useRealtimeNotifications` | ✅ Toujours fonctionnel |
| **Background / Lock screen** | Edge Functions → `sendPushToUser` → Expo Push API → APNs/FCM → device | ✅ Android OK / iOS : rebuild requis |

---

### 20.2 Credentials configurés dans EAS (via API GraphQL le 23/08/2026)

#### iOS — APNs Push Key ✅ CONFIGURÉ
| Champ | Valeur |
|-------|--------|
| Key ID | `8B2UX9XA8J` |
| Fichier | `c:\Users\USER\Downloads\AuthKey_8B2UX9XA8J.p8` |
| Team ID | `8DH7238995` (ABY BABEL SOW — Individual) |
| EAS Apple Team ID (interne) | `71e04e35-91dc-4a19-8af1-303af2429932` |
| EAS Push Key ID (interne) | `688d9b25-c9b5-4125-b779-0beb05b5130e` |
| Associé à | `com.lassiapp.lassiapp` — credentials `52bb213d-60c9-4fe4-a10a-8a37643a85c0` |
| Vérifié sur Apple Dev Portal | aps-environment=production ✅, App ID push activé ✅ |

**Comment a-t-on configuré ?** Via API EAS GraphQL (pas `eas credentials` — ne fonctionne pas sans terminal interactif avec le compte Apple owner). Mutations utilisées :
- `appleTeam.createAppleTeam` → créer l'équipe Apple dans EAS
- `applePushKey.createApplePushKey` → uploader la clé `.p8`
- `iosAppCredentials.setPushKey` → lier la clé à l'app

#### Android — FCM v1 Service Account ✅ CONFIGURÉ
| Champ | Valeur |
|-------|--------|
| Fichier | `c:\Users\USER\Desktop\lassiapp\KEY\lassiapp-firebase-adminsdk-fbsvc-d3f10adf25.json` |
| Project ID Firebase | `lassiapp` |
| Client email | `firebase-adminsdk-fbsvc@lassiapp.iam.gserviceaccount.com` |
| EAS GSA Key ID (interne) | `21b65d1d-aa56-438f-a2e3-bb7f6e97ac3a` |
| Associé à | `com.lassiapp.lassiapp` ET `com.lassiapp.LassiApp` |

**Comment ?** Via API EAS GraphQL, mutations :
- `googleServiceAccountKey.createGoogleServiceAccountKey`
- `androidAppCredentials.setGoogleServiceAccountKeyForFcmV1`

**Test Android :** `status: "ok"` sur 2 tickets Expo → push Android **FONCTIONNE** ✅

---

### 20.3 Pourquoi iOS ne fonctionne pas encore (build 18)

**Root cause identifiée par diagnostic Supabase (table `push_log`) :**
```
getDevicePushTokenAsync timeout 10s
```

iOS ne retourne jamais le token APNs natif. Cause : le **binaire du build 18 (22/08/2026) n'a pas l'entitlement `aps-environment` correctement signé dans sa signature de code** (le `.entitlements` n'avait pas été généré avec push au moment du build, avant qu'on configure la clé APNs dans EAS).

Pourtant :
- Le provisioning profile `4V89HC89RH` A `aps-environment: production` ✅ (vérifié via ASC API)
- L'App ID `com.lassiapp.lassiapp` a PUSH_NOTIFICATIONS activé ✅

**Solution : REBUILD iOS obligatoire.** Aucun OTA ne peut corriger l'entitlement dans le binaire natif.

Avec les credentials configurés aujourd'hui, le prochain build EAS va :
1. Régénérer le provisioning profile avec push
2. Signer le binaire AVEC `aps-environment: production`
3. Les tokens iOS s'enregistreront immédiatement

---

### 20.4 Infrastructure de diagnostic créée (23/08/2026)

#### Table `push_log`
Migration : `supabase/migrations/20260823190000_push_log_table.sql`
Colonnes : `user_id, platform, status, token_prefix, error_msg, created_at`
Rôle : reçoit les événements de `usePushToken.ts` pour diagnostiquer à distance sans Xcode

Statuts loggés par le hook :
- `hook_started` → hook lancé
- `permission_granted` / `permission_denied` → résultat iOS permission
- `device_token_ok` / `device_token_error` → résultat `getDevicePushTokenAsync`
- `expo_token_error` → échec `getExpoPushTokenAsync`
- `token_saved` → token enregistré en DB avec succès
- `error` / `fatal_error` → erreur inattendue

#### Edge Functions déployées
- `push-log` : reçoit les diagnostics depuis l'app (no-verify-jwt)
- `test-push` : envoie un push de test à un userId (no-verify-jwt, pas d'auth requise)

#### Requête de vérification push (à utiliser après rebuild)
```powershell
$key = "eyJ...service_role_key..."
Invoke-RestMethod -Uri "https://tsdemraszwtbzgtyjzum.supabase.co/rest/v1/push_log?select=*&order=created_at.desc&limit=10" -Headers @{Authorization="Bearer $key"; apikey=$key} | ConvertTo-Json -Depth 3
```

---

### 20.5 ⚡ CHECKLIST OBLIGATOIRE — Prochain build iOS (inclure push)

> Ces étapes sont déjà faites côté EAS credentials. Le build EAS va les utiliser automatiquement.

```
[x] APNs Key 8B2UX9XA8J uploadée dans EAS ✅
[x] Apple Team 8DH7238995 enregistré dans EAS ✅
[x] Clé liée à com.lassiapp.lassiapp dans EAS ✅
[x] App ID push notifications activé sur Apple Dev Portal ✅
[x] Provisioning profile 4V89HC89RH actif avec aps-environment:production ✅

[ ] LANCER : eas build --platform ios --profile production
[ ] Après build : soumettre à TestFlight via eas submit ou App Store Connect
[ ] Après installation TestFlight : ouvrir l'app 30s → vérifier push_log → status doit être "token_saved"
[ ] Tester push end-to-end : POST /functions/v1/test-push → status "sent" sur iOS
```

---

### 20.6 Commande de test push (après rebuild)

```powershell
# Tester le push vers un utilisateur spécifique
Invoke-RestMethod -Uri "https://tsdemraszwtbzgtyjzum.supabase.co/functions/v1/test-push" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"userId":"<USER_ID>"}' | ConvertTo-Json -Depth 5

# Vérifier les tokens enregistrés pour tous les users (limite 10)
$key="<SERVICE_ROLE_KEY>"
Invoke-RestMethod -Uri "https://tsdemraszwtbzgtyjzum.supabase.co/rest/v1/push_tokens?select=user_id,platform,updated_at&order=updated_at.desc&limit=10" -Headers @{Authorization="Bearer $key"; apikey=$key} | ConvertTo-Json
```

---

### 20.7 Compte Apple Developer — accès EAS credentials

**Problème connu :** `eas credentials --platform ios` nécessite un terminal interactif avec le compte Apple Developer **owner** (`abybabel2002@icloud.com` — ABY BABEL SOW).  
`lassiapp33@gmail.com` est Admin App Store Connect mais pas propriétaire du compte → `eas credentials` échoue.

**Solution alternative (utilisée le 23/08/2026) :** API EAS GraphQL directe avec la session `lassiapp` + clé `.p8` téléchargée par le propriétaire manuellement.

Si de nouvelles clés APNs sont nécessaires dans le futur :
1. Propriétaire (Aby) va sur developer.apple.com → Keys → crée une clé APNs
2. Télécharge le `.p8` → donne le fichier + Key ID
3. On uploade via API EAS GraphQL (mutations ci-dessus)

---

## 21. SUPPRESSION COMPTE ADMIN — ARCHITECTURE ET RÈGLES (2026-08-25)

### 21.1 Architecture finale

**EF** `supabase/functions/admin-delete-user/index.ts` :
1. Vérifie is_admin du caller
2. Empêche suppression d'un admin
3. **Check payouts `queued`/`processing` → 409 si > 0** (protection financière intentionnelle)
4. Log admin_actions_log + audit
5. `admin.rpc('admin_purge_user_data', { p_user_id })` ← purge SQL SECURITY DEFINER
6. `auth.admin.deleteUser(targetUserId)`

**Fonction SQL** `admin_purge_user_data` (migration `20260825240000_fn_admin_purge_user_data_v3.sql`) :
```sql
SET LOCAL row_security = off;  -- OBLIGATOIRE sinon SELECTs filtrés par RLS
-- ordre : payment_logs → payout_queue → livraison_paiements → payment_intents
-- → payout_queue (prestataire_id) → payments NULL-out → favorites
-- → order_items/orders client → boutique (orders/debts/products/shops)
-- → disputes/messages → table_reservations → profiles
```

### 21.2 Règles NON-RÉGRESSION

**R1** — `SET LOCAL row_security = off` OBLIGATOIRE dans la fonction SQL. Sans ça : "gave unexpected result" sur payment_logs (RLS bloque le SET NULL interne PostgreSQL).

**R2** — `payout_queue.prestataire_id → profiles ON DELETE RESTRICT` = intentionnel. Ne jamais changer en CASCADE.

**R3** — Toute nouvelle table avec FK → `profiles(id)` ou `auth.users(id)` doit avoir `ON DELETE CASCADE` ou `SET NULL`. Sinon ajouter le DELETE dans `admin_purge_user_data` + nouvelle migration.

**R4** — Le modal `DeleteModal` doit garder la prop `error` pour afficher les erreurs DANS le modal (pas derrière).

**R5** — Si une nouvelle erreur FK apparaît : créer migration FK fix + ajouter DELETE dans la fonction SQL v suivante.

### 21.3 FK déjà fixées

| Table | Colonne | Fix |
|---|---|---|
| payment_intents | client_id, prestataire_id → profiles | CASCADE (20260624020000) |
| payment_logs | payment_intent_id → payment_intents | SET NULL (20260625010000) |
| order_ratings | rater_id, rated_id → auth.users | CASCADE (20260727000000) |
| livraisons | demandeur_id → auth.users | CASCADE (20260727000000) |
| livraison_paiements | demandeur_id → auth.users | CASCADE (20260727000000) |
| admin_actions_log | target_user_id → profiles | SET NULL (20250101031000) |
| table_reservations | client_id → auth.users | CASCADE (20260825200000) |
| payments | prestataire_id → auth.users | SET NULL (20260825220000) |

### 21.4 Bug horaires passant minuit (2026-08-25)

`services/hours.ts` — `computeStatus()` gère maintenant les horaires overnight (ex: 9h→1h du matin).
Règle : si `closeMin < openMin` → horaire nocturne → `isOpen = nowMin >= openMin || nowMin < closeMin`.
OTA déployé : update group `0f5ba207-8c4e-4a45-8cd1-2840ff139445`.

---

## 13. POUR AJOUTER UNE MÉMOIRE

Dis à Claude : **"mémorise que [information]"** ou **"souviens-toi de [information]"**  
Claude ajoutera le bloc dans la section appropriée de ce fichier.

---

*Dernière mise à jour : 2026-08-22*
