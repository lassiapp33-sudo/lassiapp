// Polyfill URL requis par Supabase dans React Native (inutile sur web)
import { AppState, Platform } from 'react-native';
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
import { secureStorage, SESSION_ACTIVE_KEY } from './secureStorage';

// Si les vars sont absentes (OTA publiée sans env), on fournit des placeholders valides
// pour que createClient() ne throw pas. L'app affiche un écran d'erreur via SUPABASE_MISCONFIGURED.
// Root cause : expo export doit être lancé AVEC $env:EXPO_PUBLIC_* dans le même appel PS.
export const SUPABASE_MISCONFIGURED =
  !process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
export const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (SUPABASE_MISCONFIGURED) {
  logger.warn("[Supabase] Variables d'env manquantes — OTA publiée sans env vars ?");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 SESSION GUARDIAN — ZONE ROUGE — NE PAS MODIFIER SANS AUTORISATION EXPLICITE
//    Ce bloc gère l'immortalité des sessions utilisateur.
//    Toute modification ici peut provoquer des déconnexions massives en production.
//    Auteur : Lassana Coulibaly — blindé le 2026-09-27
// ═══════════════════════════════════════════════════════════════════════════════

// Les appels d'auth (refresh token) reçoivent un timeout PLUS LONG que les appels
// API normaux. Sur réseau 3G/4G lent (Sénégal), un refresh peut prendre 15-20s.
// Un timeout trop court tue le refresh → token considéré expiré → déconnexion.
// API_TIMEOUT_MS  : requêtes REST normales
// AUTH_TIMEOUT_MS : uniquement les appels /auth/v1/ (refresh, login, logout)
const API_TIMEOUT_MS  = 15_000;
const AUTH_TIMEOUT_MS = 35_000;

function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const url =
    typeof input === 'string' ? input
    : input instanceof URL    ? input.href
    : (input as Request).url;
  const isAuthCall = url.includes('/auth/v1/');
  const ms = isAuthCall ? AUTH_TIMEOUT_MS : API_TIMEOUT_MS;

  const fetchPromise = fetch(input, init);
  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('Network timeout')), ms),
  );
  return Promise.race([fetchPromise, timeoutPromise]);
}

// Client Supabase partagé dans toute l'app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: { fetch: fetchWithTimeout },
});

// Token caché : mis à jour à chaque changement d'état auth (login, refresh, logout).
let _cachedToken: string | null = null;

// ── SESSION GUARDIAN — DÉTECTION LOGOUT EXPLICITE ─────────────────────────
// FLAG DÉDIÉ — NE PAS remplacer par `_cachedToken === null`.
// Raison : _cachedToken est null à l'init du module (cold start, OTA reload).
// Si SIGNED_OUT fire avant le 1er SIGNED_IN (réseau lent, Doze Android, reuse
// detection suite à coupure réseau), `_cachedToken === null` était un faux
// positif → SESSION_ACTIVE_KEY supprimé → déconnexion au prochain démarrage.
// Ce flag n'est levé QUE par markExplicitLogout() appelé depuis logout() et
// les déconnexions volontaires — jamais par l'état de démarrage du module.
let _explicitLogoutPending = false;

export function markExplicitLogout(): void {
  _explicitLogoutPending = true;
  // Sécurité : si SIGNED_OUT ne se déclenche jamais (réseau coupé), reset après 15s
  setTimeout(() => { _explicitLogoutPending = false; }, 15_000);
}
// ────────────────────────────────────────────────────────────────────────────

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    _cachedToken = session.access_token;
    if (Platform.OS !== 'web') {
      AsyncStorage.setItem(SESSION_ACTIVE_KEY, '1').catch(() => {});
      try { supabase.realtime.setAuth(session.access_token); } catch { /* noop */ }
    }
  } else if (_event === 'SIGNED_OUT') {
    // ── SESSION GUARDIAN — RÈGLE CRITIQUE ──────────────────────────────────
    // Sur SIGNED_OUT involontaire (réseau instable Sénégal / refresh_token reuse
    // détecté car la réponse n'est jamais arrivée) : NE PAS effacer _cachedToken.
    // Avec JWT 24h (obligatoire dans le dashboard Supabase), l'access_token reste
    // valide jusqu'à son exp naturel — getValidToken() niveau 1 continue à servir
    // toutes les requêtes API sans interruption.
    //
    // On utilise _explicitLogoutPending (flag dédié) — pas _cachedToken === null
    // qui était un faux positif au cold start / OTA reload.
    const wasExplicit = _explicitLogoutPending;
    _explicitLogoutPending = false;
    if (wasExplicit && Platform.OS !== 'web') {
      AsyncStorage.removeItem(SESSION_ACTIVE_KEY).catch(() => {});
    }
    if (Platform.OS !== 'web') {
      try { supabase.realtime.setAuth(wasExplicit ? null : _cachedToken); } catch { /* noop */ }
    }
    // ────────────────────────────────────────────────────────────────────────
  }
});

export function getCachedToken(): string | null {
  return _cachedToken;
}
export function setCachedToken(token: string | null): void {
  _cachedToken = token;
}

// Vérifie que le JWT n'est pas expiré (marge skewSec) en décodant le claim `exp`.
function isJwtFresh(token: string, skewSec = 60): boolean {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(b64)) as { exp?: number };
    if (!exp) return false;
    return exp * 1000 > Date.now() + skewSec * 1000;
  } catch {
    return false;
  }
}

// Indique si le dernier _silentRefresh() a échoué sur une vraie erreur auth (4xx)
// vs une panne réseau (timeout/exception). Utilisé par getValidToken() pour décider
// si on doit déconnecter l'utilisateur ou juste laisser l'erreur se propager.
let _lastRefreshWasAuthError = false;

// Refresh silencieux avec 3 tentatives + backoff exponentiel.
// Stop immédiatement sur erreur serveur (4xx) pour éviter la détection de reuse
// du refresh_token : si le serveur a déjà roté le token mais qu'on n'a pas reçu
// la réponse (coupure réseau Android), relancer déclenche SIGNED_OUT côté Supabase.
async function _silentRefresh(): Promise<string | null> {
  _lastRefreshWasAuthError = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1_500 * attempt));
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (data.session?.access_token) {
        setCachedToken(data.session.access_token);
        return data.session.access_token;
      }
      // Erreur serveur (token révoqué, reuse détecté, session inconnue, pas de session) → stop
      if (error?.status && error.status >= 400 && error.status < 500) {
        _lastRefreshWasAuthError = true;
        break;
      }
    } catch { /* réseau indisponible — on réessaie */ }
  }
  return null;
}

// ── SESSION WATCHDOG — NE JAMAIS SUPPRIMER ────────────────────────────────────
// Filet de sécurité ultime : toutes les 4 min en foreground, vérifie que le token
// est frais. Si GoTrue rate son auto-refresh ou si un bug futur casse AppState,
// la session sera récupérée avant la prochaine requête API.
// 4 min << 24h (durée JWT) : 0 réseau inutile tant que token ok.
let _watchdogHandle: ReturnType<typeof setInterval> | null = null;
function _startWatchdog(): void {
  if (_watchdogHandle !== null) return;
  _watchdogHandle = setInterval(() => {
    const t = getCachedToken();
    if (!t || !isJwtFresh(t, 300)) _silentRefresh().catch(() => {});
  }, 4 * 60_000);
}
function _stopWatchdog(): void {
  if (_watchdogHandle === null) return;
  clearInterval(_watchdogHandle);
  _watchdogHandle = null;
}

// ── SESSION GUARDIAN : AppState pilote startAutoRefresh + refresh proactif ───
// Au retour foreground après >1h de background, startAutoRefresh() seul ne
// rafraîchit PAS immédiatement le token déjà expiré — il repart juste le timer.
// La 1ère requête API partirait alors avec un JWT mort → 401 / RLS → "vue vide".
// Fix : on force un _silentRefresh() dès que le token a moins de 5 min de vie.
let _lastProactiveRefresh = 0;

if (Platform.OS !== 'web') {
  supabase.auth.startAutoRefresh();
  _startWatchdog(); // watchdog actif dès le chargement du module
  AppState.addEventListener('change', async state => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      _startWatchdog();
      const cached = getCachedToken();
      const now = Date.now();
      // Refresh proactif si token expiré ou dans les 5 prochaines minutes
      if ((!cached || !isJwtFresh(cached, 300)) && now - _lastProactiveRefresh > 30_000) {
        _lastProactiveRefresh = now;
        _silentRefresh().catch(() => {});
      }
    } else {
      supabase.auth.stopAutoRefresh();
      _stopWatchdog();
    }
  });
}

// Attend que GoTrue finisse son refresh (max 20 s — supérieur au 15s précédent
// pour absorber les réseaux lents sans tomber dans le timeout trop tôt).
export function safeGetSession(ms = 20_000): ReturnType<typeof supabase.auth.getSession> {
  const timeout = new Promise<{ data: { session: null }; error: null }>(resolve =>
    setTimeout(() => resolve({ data: { session: null }, error: null }), ms),
  );
  return Promise.race([supabase.auth.getSession(), timeout]);
}

// Token valide garanti : cache frais → getSession → refresh 3 tentatives.
// Ne JAMAIS supprimer ou contourner ces 3 niveaux de fallback.
export async function getValidToken(): Promise<string> {
  // Niveau 1 : cache en mémoire (accès instantané, 0 réseau)
  const cached = getCachedToken();
  if (cached && isJwtFresh(cached)) return cached;

  // Niveau 2 : session stockée sur le device (peut être plus fraîche que le cache)
  const { data: { session } } = await safeGetSession(20_000);
  if (session?.access_token && isJwtFresh(session.access_token)) {
    setCachedToken(session.access_token);
    return session.access_token;
  }

  // Niveau 3 : refresh forcé avec 3 tentatives (réseau lent / background >1h)
  const refreshed = await _silentRefresh();
  if (refreshed) return refreshed;

  // eslint-disable-next-line no-console
  console.error('[LASSI] getValidToken ECHEC — authErr=', _lastRefreshWasAuthError, 'cached=', !!getCachedToken(), 'session=', !!session, 'time=', new Date().toISOString());

  // SESSION GUARDIAN — NE DÉCONNECTER QUE SUR VRAIE ERREUR AUTH (4xx Supabase).
  // Panne réseau (timeout, ECONNREFUSED) → _lastRefreshWasAuthError = false → on laisse
  // l'erreur remonter à l'appelant sans kicker l'utilisateur. La session Supabase n'est
  // pas morte : dès que le réseau revient, le prochain appel ou le watchdog refreshera.
  if (_lastRefreshWasAuthError) {
    _sessionExpiredCallbacks.forEach(cb => { try { cb(); } catch {} });
  }
  throw new Error(_lastRefreshWasAuthError ? 'Session expirée — reconnecte-toi.' : 'Réseau indisponible — réessaie.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 FIN SESSION GUARDIAN
// ═══════════════════════════════════════════════════════════════════════════════

// ── Session expirée — callback global ────────────────────────────────────────
// Quand getValidToken() échoue après les 3 niveaux (session vraiment morte),
// tous les callbacks enregistrés ici sont appelés → App.tsx redirige vers login.
const _sessionExpiredCallbacks: Array<() => void> = [];
export function onSessionExpired(cb: () => void): () => void {
  _sessionExpiredCallbacks.push(cb);
  return () => {
    const i = _sessionExpiredCallbacks.indexOf(cb);
    if (i >= 0) _sessionExpiredCallbacks.splice(i, 1);
  };
}
