// Polyfill URL requis par Supabase dans React Native (inutile sur web)
import { AppState, Platform } from 'react-native';
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';
import { secureStorage } from './secureStorage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  logger.warn("[Supabase] Variables d'env manquantes — vérifie ton fichier .env");
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
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
  if (Platform.OS !== 'web') {
    try { supabase.realtime.setAuth(session?.access_token ?? null); } catch { /* noop */ }
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

// Refresh silencieux avec 3 tentatives + backoff exponentiel.
// Retourne le nouveau token ou null si toutes les tentatives échouent.
async function _silentRefresh(): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1_500 * attempt));
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data.session?.access_token) {
        setCachedToken(data.session.access_token);
        return data.session.access_token;
      }
    } catch { /* réseau indisponible — on réessaie */ }
  }
  return null;
}

// ── SESSION GUARDIAN : AppState pilote startAutoRefresh + refresh proactif ───
// Au retour foreground après >1h de background, startAutoRefresh() seul ne
// rafraîchit PAS immédiatement le token déjà expiré — il repart juste le timer.
// La 1ère requête API partirait alors avec un JWT mort → 401 / RLS → "vue vide".
// Fix : on force un _silentRefresh() dès que le token a moins de 5 min de vie.
let _lastProactiveRefresh = 0;

if (Platform.OS !== 'web') {
  supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', async state => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      const cached = getCachedToken();
      const now = Date.now();
      // Refresh proactif si token expiré ou dans les 5 prochaines minutes
      if ((!cached || !isJwtFresh(cached, 300)) && now - _lastProactiveRefresh > 30_000) {
        _lastProactiveRefresh = now;
        _silentRefresh().catch(() => {});
      }
    } else {
      supabase.auth.stopAutoRefresh();
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

  throw new Error('Session expirée — reconnecte-toi.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 FIN SESSION GUARDIAN
// ═══════════════════════════════════════════════════════════════════════════════
