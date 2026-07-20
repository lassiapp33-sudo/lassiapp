import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const secureStorage = new LargeSecureStore();
