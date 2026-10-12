# 🔴 SESSION GUARDIAN — ZONE ROUGE

**Ne jamais modifier `supabase.ts` sans lire ce fichier.**

## Ce qui est protégé

`Lassi/src/lib/supabase.ts` — le bloc entre les balises `SESSION GUARDIAN`.

## Pourquoi cette zone est critique

Les sessions utilisateur LASSI ne doivent JAMAIS expirer automatiquement.
Toute modification de ce bloc peut provoquer des déconnexions massives en production.

## Architecture (3 niveaux de fallback)

```
getValidToken()
  ├── Niveau 1 : cache mémoire (0 réseau, instantané)
  ├── Niveau 2 : session stockée device (safeGetSession, 20s timeout)
  └── Niveau 3 : refresh forcé × 3 tentatives + backoff (réseau lent Sénégal)
```

## Règles absolues

1. `AUTH_TIMEOUT_MS = 35_000` — NE PAS BAISSER. Le refresh peut prendre 20s+ sur 3G.
2. `API_TIMEOUT_MS = 15_000` — peut être ajusté mais pas pour les appels /auth/v1/
3. `_silentRefresh()` avec 3 tentatives — NE PAS réduire à 1 tentative.
4. `safeGetSession(20_000)` — NE PAS baisser en dessous de 20s.
5. L'AppState listener doit garder `startAutoRefresh()` + `_silentRefresh()` proactif.
6. `stopAutoRefresh()` en background EST intentionnel (économie batterie).
7. **NE PAS effacer `_cachedToken` dans le listener `onAuthStateChange` sur SIGNED_OUT involontaire.**
   - Proxy "explicit" : `logout()` appelle `setCachedToken(null)` AVANT `signOut()`.
   - Si `_cachedToken === null` quand SIGNED_OUT arrive → logout explicit → OK effacer SESSION_ACTIVE_KEY.
   - Si `_cachedToken !== null` → SIGNED_OUT involontaire (réseau/reuse) → token préservé jusqu'à exp 24h.
8. **`onSessionExpired` ne doit PAS être appelé sur panne réseau** — uniquement sur erreur auth 4xx.
   - `_lastRefreshWasAuthError = true` → vraie session morte → déconnecter.
   - `_lastRefreshWasAuthError = false` → réseau indispo → throw sans déconnecter.
9. `logout()` dans `auth.ts` doit TOUJOURS appeler `setCachedToken(null)` AVANT `signOut()`.

## Action Supabase dashboard obligatoire

**Authentication → JWT Settings → JWT expiry time**
Mettre **86400** (24 heures) au lieu de 3600 (1 heure).

Cela garantit que même si le refresh échoue 3 fois (panne réseau prolongée),
le token reste valide 24h au lieu de forcer une déconnexion après 1h.

URL : https://supabase.com/dashboard/project/[ton-project-id]/auth/configuration

## Date de blindage

2026-09-27 — Lassana Coulibaly
