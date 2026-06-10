// Polyfill crypto.getRandomValues requis par aes-js sur React Native (doit être importé avant aes-js)
import 'react-native-get-random-values';

import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage adapter pour la session Supabase (JWT access_token / refresh_token).
 *
 * expo-secure-store (Keychain iOS / Keystore Android) limite chaque entrée à
 * ~2048 octets, ce qui est insuffisant pour stocker un objet de session
 * complet. On applique donc le pattern recommandé par Supabase :
 *  - une clé AES-256 aléatoire est générée et stockée dans SecureStore
 *    (matériel sécurisé, petite taille) ;
 *  - la session JWT est chiffrée avec cette clé (AES-CTR) puis le résultat
 *    chiffré est stocké dans AsyncStorage (taille illimitée mais inutile
 *    sans la clé issue du Keystore/Keychain).
 */
class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }

    return this._decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

export const secureStorage = new LargeSecureStore();
