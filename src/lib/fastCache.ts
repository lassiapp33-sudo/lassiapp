import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

// Cache AsyncStorage non-chiffré (lecture ~50ms, sans Android Keystore).
// Utilisé pour afficher les données du dernier démarrage immédiatement,
// pendant que GoTrue libère son mutex en arrière-plan.

const PREFIX = 'fc_';

export async function getFastCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn('[fastCache] get', key, err);
    return null;
  }
}

export async function setFastCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    logger.warn('[fastCache] set', key, err);
  }
}
