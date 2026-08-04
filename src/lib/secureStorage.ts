import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clé AsyncStorage (rapide, sans Keystore) indiquant qu'une session existe.
// Lue AVANT que GoTrue lise le Keystore — si absente, on retourne null à GoTrue
// pour éviter le refresh de token bloquant (12s fetchWithTimeout) au démarrage.
export const SESSION_ACTIVE_KEY = 'lassi_session_active';

// react-native-get-random-values et expo-secure-store sont natifs uniquement
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-get-random-values');
  } catch (_) {
    // Fallback silencieux — crypto.getRandomValues sera fourni par Hermes si absent
  }
}

class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aesjs = require('aes-js');
    let encryptionKey: Uint8Array;
    try {
      encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    } catch {
      // Fallback si crypto.getRandomValues indisponible (Android < 9 / Hermes sans polyfill)
      encryptionKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) encryptionKey[i] = Math.floor(Math.random() * 256);
    }
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aesjs = require('aes-js');
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this._decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    if (Platform.OS !== 'web') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const _rawSecureStorage = new LargeSecureStore();

// Accessible pour les stores Zustand qui doivent chiffrer des données sensibles (PII)
// sans le verrou de session GoTrue (ex: authStore cache nom/téléphone/email).
export const rawSecureStorage: Pick<LargeSecureStore, 'getItem' | 'setItem' | 'removeItem'> =
  _rawSecureStorage;

// Wrapper GoTrue-aware : si SESSION_ACTIVE_KEY absent, retourne null pour tous les
// getItem() de GoTrue → pas de token stale → pas de refresh réseau → init instantanée.
// Dès qu'un setItem() est appelé (login réussi), la session est considérée active.
class SessionAwareStorage {
  private _checked = false;
  private _active = false;

  private async _ensureChecked(): Promise<void> {
    if (this._checked) return;
    this._checked = true;
    const flag = await AsyncStorage.getItem(SESSION_ACTIVE_KEY).catch(() => null);
    this._active = !!flag;
  }

  async getItem(key: string): Promise<string | null> {
    await this._ensureChecked();
    if (!this._active) return null;
    return _rawSecureStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this._active = true;
    return _rawSecureStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return _rawSecureStorage.removeItem(key);
  }
}

export const secureStorage = new SessionAwareStorage();
