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
    // Premier essai immédiat
    const flag0 = await AsyncStorage.getItem(SESSION_ACTIVE_KEY).catch(() => null);
    if (flag0) {
      this._active = true;
      this._checked = true;
      return;
    }
    // Sur Android, AsyncStorage peut retourner null pendant plusieurs centaines de ms
    // après un OTA reload (Updates.reloadAsync) ou sur Samsung Android 12+ (SELinux strict)
    // car le storage bridge n'est pas encore monté au moment du premier appel JS.
    // On retente 4 fois avec backoff progressif (100ms→300ms→600ms→1000ms) avant de
    // conclure que la session est absente — sinon _active reste false définitivement
    // et GoTrue ne charge jamais le refresh_token → getValidToken() échoue → kick login.
    const delays = [100, 300, 600, 1000];
    for (const ms of delays) {
      await new Promise(r => setTimeout(r, ms));
      const flagN = await AsyncStorage.getItem(SESSION_ACTIVE_KEY).catch(() => null);
      if (flagN) {
        this._active = true;
        this._checked = true;
        return;
      }
    }
    this._active = false;
    this._checked = true;
  }

  async getItem(key: string): Promise<string | null> {
    // Pass-through direct — le verrou _active causait des faux négatifs Android :
    // GoTrue recevait null, démarrait sans session, _cachedToken restait null,
    // et getValidToken() throwait "Session expirée" même si le token était en storage.
    return _rawSecureStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this._active = true;
    return _rawSecureStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return _rawSecureStorage.removeItem(key);
  }

  // Réinitialise l'état actif (appelé par supabase.ts sur SIGNED_OUT explicite).
  // Empêche GoTrue de tenter de lire le storage après un logout volontaire jusqu'au
  // prochain login (setItem remet _active=true automatiquement).
  resetActive(): void {
    this._active = false;
    // Ne pas reset _checked : GoTrue peut re-vérifier sans re-attendre le backoff
  }
}

export const secureStorage = new SessionAwareStorage();
