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

// Client Supabase partagé dans toute l'app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Session JWT chiffrée (AES-256, clé dans le Keychain/Keystore via expo-secure-store)
    storage: secureStorage,
    autoRefreshToken: true, // renouvelle le token silencieusement avant expiration
    persistSession: true, // sauvegarde la session sur le téléphone
    detectSessionInUrl: Platform.OS === 'web',
  },
});
