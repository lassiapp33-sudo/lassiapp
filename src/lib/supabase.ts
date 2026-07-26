// Polyfill URL requis par Supabase dans React Native (inutile sur web)
import { Platform } from 'react-native';
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
});
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
