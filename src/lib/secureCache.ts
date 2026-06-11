import { secureStorage } from './secureStorage';
import logger from '../utils/logger';

// Section 10 — Stockage local sécurisé.
// Cache chiffré (AES-256, clé Keychain/Keystore via secureStorage) pour les
// données sensibles consultées en mode dégradé (ex : cahier de dettes), afin
// que l'app reste utilisable hors-ligne sans exposer ces données en clair.

const PREFIX = 'cache_';

/** Best-effort : une erreur de cache ne doit jamais bloquer l'app. */
export async function getCachedJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await secureStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn('[secureCache] getCachedJSON', key, err);
    return null;
  }
}

export async function setCachedJSON<T>(key: string, value: T): Promise<void> {
  try {
    await secureStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    logger.warn('[secureCache] setCachedJSON', key, err);
  }
}

export async function removeCachedJSON(key: string): Promise<void> {
  try {
    await secureStorage.removeItem(PREFIX + key);
  } catch (err) {
    logger.warn('[secureCache] removeCachedJSON', key, err);
  }
}
