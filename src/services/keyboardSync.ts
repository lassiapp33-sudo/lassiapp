// ── Synchro des données marchand vers le clavier vendeur LASSI ────────────────
// Construit le payload (lien vitrine, puces, réponses rapides, fond) et l'écrit
// dans le stockage lu par le clavier :
//   - iOS     : App Group (via le module natif lassi-keyboard)
//   - Android : fichier filesDir/lassi_keyboard.json (via expo-file-system),
//               lu par l'InputMethodService injecté par withLassiKeyboardAndroid.
//
// Appelé à la connexion marchand et à chaque mise à jour du profil/vitrine.

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  setMerchantData as iosSetMerchantData,
  clearMerchantData as iosClearMerchantData,
  openKeyboardSettings as iosOpenKeyboardSettings,
  type MerchantKeyboardData,
  type QuickReply,
  type KeyboardChip,
} from '../../modules/lassi-keyboard';

const VITRINE_BASE = 'https://s.lassi.tech';
const PREFS_KEY = (shopId: string) => `lassi_keyboard_prefs_${shopId}`;
const ANDROID_FILE = `${FileSystem.documentDirectory ?? ''}lassi_keyboard.json`;

export interface KeyboardPrefs {
  quickReplies: QuickReply[];
  background: MerchantKeyboardData['background'];
}

/** Puces par défaut de la barre LASSI (haut du clavier). */
export function defaultChips(): KeyboardChip[] {
  return [
    { id: 'vitrine', emoji: '🔗', label: 'Ma vitrine', insert: '{lien}' },
    { id: 'catalogue', emoji: '📦', label: 'Catalogue', insert: 'Voici mon catalogue 👉 {lien}' },
    { id: 'commander', emoji: '💬', label: 'Commander ici', insert: 'Commandez directement ici 👉 {lien}' },
  ];
}

/** Réponses rapides de vente par défaut (éditables par le marchand). */
export function defaultQuickReplies(shopName: string): QuickReply[] {
  return [
    { id: 'bonjour', label: '👋 Bonjour', text: `Bonjour 👋 Bienvenue chez ${shopName}. Voici ma boutique : {lien}` },
    { id: 'dispo', label: '✅ Disponible', text: 'Oui c’est disponible ✅' },
    { id: 'prix', label: '🏷️ Prix', text: 'Le prix est de … FCFA' },
    { id: 'livraison', label: '🛵 Livraison', text: 'Livraison possible 🛵 — dites-moi votre quartier.' },
    { id: 'merci', label: '🙏 Merci', text: 'Merci pour votre confiance 🙏 À très vite !' },
  ];
}

/** Charge les préférences clavier persistées du marchand (ou défauts). */
export async function loadKeyboardPrefs(shopId: string, shopName: string): Promise<KeyboardPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY(shopId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeyboardPrefs>;
      return {
        quickReplies: parsed.quickReplies?.length ? parsed.quickReplies : defaultQuickReplies(shopName),
        background: parsed.background ?? null,
      };
    }
  } catch { /* fallback défauts */ }
  return { quickReplies: defaultQuickReplies(shopName), background: null };
}

/** Enregistre les préférences clavier et re-synchronise aussitôt. */
export async function saveKeyboardPrefs(
  shopId: string,
  shopName: string,
  slug: string | null,
  prefs: KeyboardPrefs,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY(shopId), JSON.stringify(prefs));
  } catch { /* non bloquant */ }
  await syncKeyboard({ shopId, shopName, slug, prefs });
}

interface SyncArgs {
  shopId: string;
  shopName: string;
  slug: string | null;
  prefs?: KeyboardPrefs;
}

/** Écrit les données marchand dans le stockage lu par le clavier (par OS). */
export async function syncKeyboard({ shopId, shopName, slug, prefs }: SyncArgs): Promise<void> {
  if (!slug) return; // pas de vitrine publique → rien à proposer
  const vitrineUrl = `${VITRINE_BASE}/${slug}`;
  const resolved = prefs ?? (await loadKeyboardPrefs(shopId, shopName));

  const data: MerchantKeyboardData = {
    vitrineUrl,
    shopName,
    chips: defaultChips(),
    quickReplies: resolved.quickReplies,
    background: resolved.background ?? null,
  };

  try {
    if (Platform.OS === 'ios') {
      await iosSetMerchantData(data);
    } else {
      await FileSystem.writeAsStringAsync(ANDROID_FILE, JSON.stringify(data));
    }
  } catch { /* module/fichier indisponible — ignoré */ }
}

/** Efface les données à la déconnexion. */
export async function clearKeyboard(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await iosClearMerchantData();
    } else {
      await FileSystem.deleteAsync(ANDROID_FILE, { idempotent: true });
    }
  } catch { /* ignoré */ }
}

/** Ouvre les réglages clavier de l'OS (activation du clavier LASSI). */
export async function openKeyboardSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.INPUT_METHOD_SETTINGS');
    } else {
      await iosOpenKeyboardSettings();
    }
  } catch { /* ignoré */ }
}
