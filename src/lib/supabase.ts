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

// Chaque requête Supabase (auth token refresh + REST) passe par ce fetch.
// AbortController ne coupe pas fiablement le fetch natif Android — on utilise
// Promise.race (pur JS) pour garantir le timeout même sur Android.
// Quand ce timeout se déclenche, GoTrue reçoit l'erreur, libère son mutex interne
// et toutes les requêtes en attente peuvent continuer (avec session null si refresh échoué).
function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const fetchPromise = fetch(input, init);
  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('Network timeout')), 12_000),
  );
  return Promise.race([fetchPromise, timeoutPromise]);
}

// Client Supabase partagé dans toute l'app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Session JWT chiffrée (AES-256, clé dans le Keychain/Keystore via expo-secure-store)
    storage: secureStorage,
    autoRefreshToken: true, // renouvelle le token silencieusement avant expiration
    persistSession: true, // sauvegarde la session sur le téléphone
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: { fetch: fetchWithTimeout },
});

// Token caché : mis à jour à chaque changement d'état auth (login, refresh, logout).
// Accès synchrone instantané — évite toute attente du mutex GoTrue pour les appels API.
let _cachedToken: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
  // Propage le token frais au websocket Realtime. Sans ça, après un refresh
  // (ou expiration à 1h) le socket garde l'ancien JWT → le serveur ferme la
  // connexion, les abonnements meurent et "rien ne vient" jusqu'au relogin.
  if (Platform.OS !== 'web') {
    try { supabase.realtime.setAuth(session?.access_token ?? null); } catch { /* noop */ }
  }
});

// ── Session qui n'expire JAMAIS (Android + iOS) ──────────────────────────────
// EXIGENCE officielle Supabase RN : autoRefreshToken ne tourne de façon fiable
// que si on le pilote via AppState. Sans ce wiring, l'app en arrière-plan
// (doze Android) ne rafraîchit pas le JWT → expiration à 1h → obligation de se
// déconnecter/reconnecter. On (re)démarre le refresh dès que l'app est active
// et on l'arrête en arrière-plan.
if (Platform.OS !== 'web') {
  // Démarre tout de suite (l'app est active au lancement), puis AppState pilote.
  supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
export function getCachedToken(): string | null {
  return _cachedToken;
}
// Permet à auth.ts de mettre à jour le cache immédiatement après un login raw
export function setCachedToken(token: string | null): void {
  _cachedToken = token;
}

// Fallback : attend que GoTrue finisse son refresh (max 15 s).
// fetchWithTimeout garantit que le refresh HTTP se termine en ≤12 s,
// donc 15 s laisse 3 s de marge pour que le mutex soit libéré.
export function safeGetSession(ms = 15_000): ReturnType<typeof supabase.auth.getSession> {
  const timeout = new Promise<{ data: { session: null }; error: null }>(resolve =>
    setTimeout(() => resolve({ data: { session: null }, error: null }), ms),
  );
  return Promise.race([supabase.auth.getSession(), timeout]);
}

// Vérifie que le JWT n'est pas expiré (marge de 60 s) en décodant le claim `exp`.
// Sans ça, un token en cache expiré était renvoyé tel quel → 401 "Non autorisé"
// côté Edge Function et violation RLS sur les INSERT (auth.uid() = NULL).
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

// Token valide garanti : cache (non expiré) → getSession → refreshSession.
// Couvre le cas app en background >1h : token expiré, autoRefreshToken n'a pas pu tourner.
export async function getValidToken(): Promise<string> {
  const cached = getCachedToken();
  if (cached && isJwtFresh(cached)) return cached;

  const { data: { session } } = await safeGetSession(15_000);
  if (session?.access_token && isJwtFresh(session.access_token)) {
    setCachedToken(session.access_token);
    return session.access_token;
  }

  // Dernier recours : forcer le refresh avec le refresh_token stocké
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData.session?.access_token) {
    setCachedToken(refreshData.session.access_token);
    return refreshData.session.access_token;
  }

  throw new Error('Session expirée — reconnecte-toi.');
}
