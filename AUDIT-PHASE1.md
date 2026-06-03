# AUDIT PHASE 1 — LASSI App
> Généré le 2026-06-02 · Lecture seule · Aucun fichier modifié

---

## 1. VUE D'ENSEMBLE

### Structure des dossiers (résumée)
```
lassiapp/
├── LassiApp/                    ← App React Native (Expo)
│   └── src/
│       ├── components/          (80 composants, 12 sous-dossiers)
│       ├── screens/             (50 écrans, 7 sous-dossiers)
│       ├── services/            (23 services Supabase)
│       ├── store/               (10 stores Zustand)
│       ├── hooks/               (5 hooks custom)
│       ├── types/               (8 fichiers de types)
│       ├── config/              (categories.ts, contact.ts)
│       ├── i18n/                (fr/en)
│       ├── theme.ts
│       └── lib/supabase.ts
├── lassi-admin/                 ← Dashboard admin React+Vite
│   └── src/
│       ├── pages/               (11 pages)
│       ├── services/            (6 services)
│       └── components/          (8 composants)
└── supabase/
    ├── functions/               (7 Edge Functions)
    └── migrations/              (22 fichiers SQL)
```

### Stack détectée
| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Expo SDK | 54 |
| UI | React Native | 0.81.5 |
| Langage | TypeScript | 5.9 |
| Backend | Supabase (Auth + DB + Storage + Realtime) | — |
| State | Zustand | 5.x |
| Navigation | Navigateurs custom JS (pas React Navigation) | — |
| Audio | expo-av | — |
| Notifications | expo-notifications (lazy-require) | — |
| Fonts | expo-google-fonts (Plus Jakarta Sans + Poppins) | — |
| Admin | React + Vite + Tailwind | — |
| Edge Functions | Deno (Supabase Functions) | — |

### Comptages
- **Écrans** : ~50 (client : ~25, merchant : ~12, auth : ~6, communs : ~7)
- **Composants** : ~80
- **Services** : 23 (app) + 6 (admin)
- **Stores Zustand** : 10
- **Hooks** : 5
- **Edge Functions** : 7
- **Migrations SQL** : 22

---

## 2. PROBLÈMES CRITIQUES 🔴

### 🔴-1 — Paiement/Visibilité fictif (VisibilityScreen)
**Fichier** : `src/screens/merchant/VisibilityScreen.tsx` lignes 94 + 107  
`handlePay()` appelle `setView('subscribed')` **sans aucun appel API ni vérification de paiement**. Le forfait est marqué actif localement et perdu au rechargement. De plus, `ActiveSubCard` reçoit des données entièrement hardcodées (`planLabel='3 mois'`, `daysLeft=47`, `expiryDate='21 juillet 2026'`, `progress=0.62`) — aucune donnée réelle n'est chargée depuis le store ou Supabase.  
→ **Le flux d'abonnement marchand est non fonctionnel et trompeur.**

### 🔴-2 — Refus commande sans appel API (OrdersScreen)
**Fichier** : `src/screens/merchant/OrdersScreen.tsx` ligne 154  
`onRefuse` appelle `removeOrder()` côté client uniquement, sans mise à jour en base. La commande reste à l'état `'new'` dans Supabase. Le marchand pense avoir refusé mais le client ne le sait pas.

### 🔴-3 — Race condition handleCheckout (CartScreen)
**Fichier** : `src/screens/home/CartScreen.tsx` ligne 102  
Après suppression des articles indisponibles (`removeItem(unavailable)`), le code relit `items.length - unavailable.length` **depuis la closure initiale** (avant la mise à jour du store). La valeur est stale — peut déclencher une commande vide ou une récursion.

### 🔴-4 — setState after unmount sans garde (ChatScreen)
**Fichier** : `src/screens/chat/ChatScreen.tsx` ligne 136  
IIFE async dans `useEffect` sans `isMounted` guard. Tous les setState (setConversationId, setMessages, setLoading…) peuvent s'exécuter après le démontage — memory leaks et warnings React en production.

### 🔴-5 — Injection JS dans MapScreen (XSS potentiel)
**Fichier** : `src/screens/home/MapScreen.tsx` ligne 284  
`injectJavaScript` avec données JSON échappées à la main. Un nom de commerce avec une apostrophe ou des caractères spéciaux brise la chaîne JS et peut provoquer un crash ou une injection. Exemple : `Boutique d'Ali` → la string JS se casse.

### 🔴-6 — Destructuring non-sécurisé de getSession()
**Fichiers** : `services/orders.ts:90`, `services/payment.ts:9`, `services/chat.ts:133`  
```ts
const { data: { session } } = await supabase.auth.getSession()
```
Si `getSession()` retourne une erreur (réseau coupé), le destructuring sur un objet vide lève une exception non capturée. 3 fichiers affectés.

### 🔴-7 — Duplication type CatId dans l'assistant
**Fichier** : `src/services/lassiAssistant.ts` ligne 7  
`CatId` est redéfini localement alors qu'il est exporté depuis `config/categories.ts`. Si une catégorie est ajoutée dans `categories.ts` sans mettre à jour l'assistant, la recherche sera silencieusement erronée (la catégorie ne sera jamais détectée).

### 🔴-8 — Référence avant déclaration dans ShopScreen
**Fichier** : `src/screens/shop/ShopScreen.tsx` ligne ~201  
`selectedOrder` est utilisé (`selectedLabel`) avant sa déclaration via `useCartStore` à la ligne ~251. Violation de l'ordre de déclaration dans un composant — ReferenceError potentielle selon le moteur JS.

---

## 3. PROBLÈMES MOYENS 🟠

### Sécurité / Données

| # | Fichier | Ligne | Problème |
|---|---------|-------|---------|
| S1 | `services/payment.ts` | 9 | `authHeaders()` envoie `Authorization: Bearer ` (token vide) si session null au lieu de lever une erreur — requête invalide envoyée à l'Edge Function sans alerte |
| S2 | `services/auth.ts` | 177 | Rollback insuffisant dans `registerMerchant()` : en cas d'erreur lors de la création de la boutique, `signOut()` est appelé côté client mais le compte Auth Supabase et le profil restent en base — profil marchand orphelin permanent |
| S3 | `services/auth.ts` | 116 | `saveConsent()` est fire-and-forget (`.catch()`) — si le consentement RGPD n'est pas sauvegardé (erreur réseau), l'inscription réussit quand même sans preuve légale |
| S4 | `services/clientOrders.ts` | 64 | `cancelOrder()` sans vérification du statut — un client peut annuler une commande déjà en cours de préparation ou livrée |

### Désynchronisation optimiste (store sans rollback)

Tous ces stores font des mutations locales optimistes puis appellent Supabase avec `.catch(console.warn)`. En cas d'échec, l'UI diverge de la DB sans resynchronisation ni alerte :

| Store | Méthodes concernées |
|-------|-------------------|
| `store/shopStore.ts` | `saveProduct()`, `removeProduct()`, `toggleStock()` |
| `store/ordersStore.ts` | `setOrderStatus()`, `removeOrder()` |
| `store/favoritesStore.ts` | `toggleFavorite()` |
| `store/debtsStore.ts` | `addToDebt()`, `markPaid()`, `removeDebtor()` |

### Erreurs silencieuses / UX cassé

| Fichier | Ligne | Problème |
|---------|-------|---------|
| `screens/home/ClientHomeScreen.tsx` | 124 | `catch {}` vide sur `loadShops` — liste vide sans message d'erreur ni bouton retry |
| `screens/home/FavoritesScreen.tsx` | 134+136 | N requêtes parallèles (1 par favori) sans limite + erreurs silencieuses |
| `screens/home/NotificationsScreen.tsx` | 87 | `markAllRead()` appelé avant que `loadNotifications()` soit fini — nouvelles notifs peuvent ne jamais être marquées |
| `screens/merchant/PromotionsScreen.tsx` | 234 | `catch {}` vide sur `load()` — aucun message d'erreur à l'utilisateur |
| `screens/home/MyDisputesScreen.tsx` | 63 | `handleSend` en cas d'erreur : silence total, l'input se vide, le client pense que son message est parti |
| `screens/merchant/RecentlyViewedScreen.tsx` | 104 | `console.warn` en production (log debug exposé) |
| `screens/merchant/DebtsScreen.tsx` | 62 | setState after unmount possible (pas de isMounted guard) |

### Logique applicative cassée

| Fichier | Ligne | Problème |
|---------|-------|---------|
| `screens/chat/ChatScreen.tsx` | 222 | Message de confirmation hardcodé `'Reçu ✅ Ta commande sera prête dans 5 min'` injecté via `setTimeout(1400ms)` localement, non persisté en base — disparaît au rechargement |
| `screens/home/HomeNavigator.tsx` | 100 | `isVip: true` hardcodé pour tous les chats ouverts depuis une vitrine, quelle que soit la réalité |
| `screens/merchant/MerchantNavigator.tsx` | 121 | `isVip: false` hardcodé pour tous les chats marchands — asymétrie avec HomeNavigator |
| `screens/merchant/MerchantDashboard.tsx` | 122 | `isVip` hardcodé à `false` dans DashHeader, jamais lu depuis le store |
| `screens/merchant/MerchantProfileScreen.tsx` | 209 | `notifOn` état local jamais persisté ni synchronisé — toggle sans effet réel |
| `screens/home/ClientProfileScreen.tsx` | 197 | `notifOn` état local identique — fonctionnalité trompeuse dans les deux profils |
| `services/clientOrders.ts` | 43 | Mapping `pay_method` : `'cash'` est mappé vers `'wave'` — un paiement en espèces s'affiche comme Wave |
| `CategoryScreen.tsx` | 107 | `getCatMeta(initialCatId).subcats[0].id` plante si `subcats` est vide (undefined.id) |
| `CategoryScreen.tsx` | 31 | `getCatConfig(catId)!` — assertion non-null sans guard, crash si catId inconnu |
| `services/promotions.ts` | 149 | `montant_fixe` peut produire `reduction = -1` si `subtotal = 0` (panier vide + promo) |

### Requêtes DB inefficaces

| Fichier | Problème |
|---------|---------|
| `screens/home/SearchScreen.tsx:99` | `getShops()` charge TOUTES les boutiques sans pagination pour filtrer côté client — non scalable |
| `screens/home/FavoritesScreen.tsx:134` | N requêtes `getShopById` en parallèle au lieu d'une seule requête `.in('id', favorites)` |
| `services/orders.ts:137` | `createOrder()` legacy (non déprécié) insère directement en DB, bypasse la validation de l'Edge Function |
| `hooks/useRealtimeOrders.ts:31` | Sur un INSERT Realtime, recharge TOUTES les commandes du shop au lieu de mapper depuis `payload.new` |

### Problèmes de build / dépendances

| Fichier | Problème |
|---------|---------|
| `package.json:40` | `@expo/ngrok` pointe vers `file:./ngrok-localtunnel-shim` — dépendance locale non versionnée, `npm install` échoue sur clone frais |
| `hooks/usePushToken.ts:11` | Détection Expo Go via `executionEnvironment === 'storeClient'` non vérifiée contre la doc Expo SDK 54 (peut avoir changé) |

---

## 4. PROBLÈMES MINEURS 🟡

### Code mort
| Fichier | Ligne | Description |
|---------|-------|-------------|
| `screens/home/CartScreen.tsx` | 323 | Style `lineItemFaded` défini, jamais utilisé |
| `screens/merchant/PromotionsScreen.tsx` | 332 | Variable `categories` calculée, jamais utilisée (seul `storeCategories` est utilisé) |
| `screens/home/MyDisputesScreen.tsx` | 125 | `const isMe = msg.senderRole !== 'admin' && true` — toujours `true`, jamais utilisé |
| `screens/merchant/OrdersScreen.tsx` | 155 | `onChat: () => { /* TODO */ }` — fonctionnalité absente |

### `console.log` / `.warn` en production
`ChatScreen.tsx` (×5), `MapScreen.tsx`, `RecentlyViewedScreen.tsx`, `PaymentScreen.tsx` (×2, données potentiellement sensibles), `MerchantProfileScreen.tsx` — logs de debug exposés en production.

### Dépendances useEffect manquantes
Pattern systématique sur : `MerchantDashboard`, `OrdersScreen`, `StoreScreen`, `MapScreen`, `HomeNavigator`, `MerchantNavigator`, `ClientHomeScreen`, `FavoritesScreen`, `NotificationsScreen`. ESLint `react-hooks/exhaustive-deps` signalera tous ces fichiers.

### Types `any` systématiques
- **Mappers DB** : `rowToShop()`, `rowToOrder()`, `rowToProduct()`, `rowToPayment()`, `rowToAvis()` utilisent tous `row: Record<string, any>` — 8+ fichiers
- **Catch clauses** : `catch (e: any)` dans `LoginScreen`, `RegisterScreen`, `MerchantShopSetupScreen`, `StoreScreen`, `DisputeFormScreen`, `PromotionsScreen`
- **Cast forcé** : `services/disputes.ts:79` — `'disputes' as any` pour contourner l'union de types du bucket storage

### Duplications / Incohérences
| Problème | Fichiers |
|---------|---------|
| `SUPABASE_URL` / `ANON_KEY` redéfinis | `orders.ts`, `payment.ts`, `account.ts` (au lieu d'importer depuis `lib/supabase.ts`) |
| `timeLabel()` dupliqué | `orders.ts` et `notifications.ts` |
| `orderId` généré avec `Math.random()` côté client | `CartScreen.tsx:115` — pas de garantie d'unicité |
| Tri par distance sur chaîne formatée (`'1.2 km'`) | `ClientHomeScreen.tsx:113` — fragile si le format change |
| Composant `Header` défini inline dans `MerchantShopSetupScreen` | Recréé à chaque render |
| Nommage `voiceUrl` utilisé pour stocker `imageUrl` | `ChatScreen.tsx:77` — confusion dans le modèle de données |

### Divers
| Fichier | Ligne | Description |
|---------|-------|-------------|
| `store/cartStore.ts` | 34 | Pas de versioning du schema AsyncStorage — migration impossible si CartItem change |
| `store/shopStore.ts` | 106 | Import dynamique `await import('./authStore')` inutile — import statique suffit |
| `services/merchantPayments.ts` | 33 | Jointure `order:order_id(items)` retourne toujours null si les items sont dans `order_items` |
| `store/locationStore.ts` | 23 | Demande la permission GPS à chaque appel `refreshLocation` sans cache |
| `screens/SplashScreen.tsx` | 41 | `onFinish` non mémoïsé peut relancer l'animation en boucle si le parent re-rend |

---

## 5. DETTE TYPESCRIPT

| Catégorie | Fichiers / Count | Impact |
|-----------|-----------------|--------|
| `Record<string, any>` dans les mappers DB | 8+ fichiers | Aucune validation des colonnes retournées par Supabase |
| `catch (e: any)` | 6+ fichiers | Accès à `e.message` peut planter sur une valeur non-Error |
| `as any` pour contourner les types | `disputes.ts`, `RevenueScreen.tsx` | Bypasse le système de types sans raison valable |
| Types non exportés / dupliqués | `lassiAssistant.ts` (CatId local vs global) | Désynchronisation silencieuse |
| Props non typées sur composants internes | `Header` inline dans MerchantShopSetupScreen | Pas de contrat d'interface |

---

## 6. TABLEAU DE PRIORITÉS

| Problème | Gravité | Fichier(s) | Effort | Phase |
|---------|---------|-----------|--------|-------|
| Paiement visibilité fictif | 🔴 | `VisibilityScreen.tsx` | Élevé | 4 (flux paiement) |
| Refus commande sans API | 🔴 | `OrdersScreen.tsx` | Faible | 3 (logique métier) |
| Race condition CartScreen | 🔴 | `CartScreen.tsx` | Moyen | 3 |
| setState after unmount ChatScreen | 🔴 | `ChatScreen.tsx` | Faible | 3 |
| XSS injectJavaScript MapScreen | 🔴 | `MapScreen.tsx` | Moyen | 3 |
| getSession() destructuring unsafe | 🔴 | `orders.ts`, `payment.ts`, `chat.ts` | Faible | 3 |
| CatId dupliqué dans l'assistant | 🔴 | `lassiAssistant.ts` | Faible | 2 |
| token vide envoyé à Edge Function | 🟠 | `payment.ts` | Faible | 3 |
| rollback registerMerchant() | 🟠 | `auth.ts` | Moyen | 4 |
| consentement RGPD fire-and-forget | 🟠 | `auth.ts` | Faible | 4 |
| cancelOrder() sans vérif. statut | 🟠 | `clientOrders.ts` | Faible | 3 |
| Stores optimistes sans rollback | 🟠 | `shopStore`, `ordersStore`, `favoritesStore`, `debtsStore` | Moyen | 5 |
| isVip hardcodé (×3) | 🟠 | `HomeNav`, `MerchantNav`, `DashHeader` | Faible | 3 |
| notifOn dead state (×2 profils) | 🟠 | `ClientProfileScreen`, `MerchantProfileScreen` | Faible | 3 |
| Message confirmation hardcodé Chat | 🟠 | `ChatScreen.tsx` | Moyen | 5 |
| cash→wave mapping clientOrders | 🟠 | `clientOrders.ts` | Faible | 2 |
| createOrder() legacy non déprécié | 🟠 | `orders.ts` | Faible | 2 |
| N+1 requêtes favoris | 🟠 | `FavoritesScreen.tsx` | Faible | 5 |
| getShops() sans pagination (Search) | 🟠 | `SearchScreen.tsx` | Moyen | 5 |
| promotions montant_fixe négatif | 🟠 | `promotions.ts` | Faible | 3 |
| CategoryScreen.tsx crashes subcats/catId | 🟠 | `CategoryScreen.tsx` | Faible | 3 |
| console.warn en prod (données sensibles) | 🟠 | `PaymentScreen`, `ChatScreen` | Faible | 2 |
| Code mort (styles, variables, TODO) | 🟡 | Multiple | Faible | 2 |
| `catch (e: any)` systématique | 🟡 | 6+ fichiers | Faible | 6 |
| `Record<string, any>` mappers DB | 🟡 | 8+ fichiers | Élevé | 6 |
| SUPABASE_URL dupliqué | 🟡 | `orders.ts`, `payment.ts`, `account.ts` | Faible | 2 |
| timeLabel() dupliqué | 🟡 | `orders.ts`, `notifications.ts` | Faible | 2 |
| Dépendances useEffect manquantes | 🟡 | ~9 fichiers | Faible | 6 |
| AsyncStorage sans versioning schema | 🟡 | `cartStore.ts` | Moyen | 6 |
| `@expo/ngrok` dépendance locale | 🟡 | `package.json` | Faible | 2 |

---

## 7. RECOMMANDATIONS D'ORDRE

### Ce qu'il faut traiter EN PREMIER (avant toute autre phase)

1. **🔴 VisibilityScreen** — Le flux d'abonnement est cassé. Un marchand qui "achète" un forfait ne l'obtient pas réellement. C'est une perte de revenu directe. À corriger avant tout autre nettoyage.

2. **🔴 OrdersScreen.onRefuse** — Un refus de commande non persisté crée une incohérence grave entre ce que voit le marchand et ce que voit le client.

3. **🔴 CartScreen race condition** — Directement sur le chemin critique du paiement.

### Ce qu'il NE FAUT PAS CASSER

| Flux | Fichiers critiques | Risque |
|------|-------------------|--------|
| **Authentification** | `services/auth.ts`, `store/authStore.ts`, `AuthNavigator.tsx` | Un bug ici bloque 100% des utilisateurs |
| **Paiement** | `services/payment.ts`, `screens/payment/PaymentScreen.tsx`, `supabase/functions/create-order/` | Transactions financières réelles |
| **RLS Supabase** | Toutes les migrations SQL | Une politique supprimée par erreur expose les données |
| **Chat temps réel** | `hooks/useRealtimeMessages.ts`, `services/chat.ts` | Perte de messages non récupérable |

### Ordre suggéré des phases suivantes

| Phase | Contenu | Durée estimée |
|-------|---------|---------------|
| **Phase 2** | Code mort, imports dupliqués, console.log, cash→wave fix, CatId fix | Faible |
| **Phase 3** | Bugs logiques critiques (🔴 OrdersScreen, CartScreen, ChatScreen, MapScreen, CategoryScreen, isVip, notifOn, cancelOrder, getSession unsafe) | Moyen |
| **Phase 4** | Flux paiement VisibilityScreen + rollback registerMerchant + RGPD | Élevé |
| **Phase 5** | Requêtes DB optimisées (N+1, pagination, stores optimistes) | Moyen |
| **Phase 6** | Dette TypeScript (any → types stricts, mappers DB typés) | Élevé |
| **Phase 7-10** | Tests, internationalisation, perf, accessibilité | Variable |

---

*Rapport généré par Claude Code — Phase 1 terminée. Aucun fichier source modifié.*
