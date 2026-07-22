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
// Sans timeout, le refresh du token JWT peut bloquer indéfiniment sur réseau lent
// et maintenir le lock GoTrue acquis — toutes les requêtes suivantes attendent en file.
// Avec ce timeout, le lock est libéré après 12 s et l'utilisateur voit un bouton "Réessayer".
function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  // Propage un éventuel signal d'annulation existant
  const existingSignal = init?.signal as AbortSignal | undefined;
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
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
