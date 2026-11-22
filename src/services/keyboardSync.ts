// ── Synchro des données marchand vers le clavier vendeur LASSI ────────────────
// Construit le payload (lien vitrine, puces, réponses rapides, fond) et l'écrit
// dans le stockage partagé natif lu par l'extension clavier.
//
// Appelé à la connexion marchand et à chaque mise à jour du profil/vitrine.
// Les réponses rapides et le fond éditables par le marchand sont persistés en
// AsyncStorage (clé par boutique) et réinjectés à chaque synchro.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setMerchantData,
  clearMerchantData,
  type MerchantKeyboardData,
  type QuickReply,
  type KeyboardChip,
} from '../../modules/lassi-keyboard';

const VITRINE_BASE = 'https://s.lassi.tech';
const PREFS_KEY = (shopId: string) => `lassi_keyboard_prefs_${shopId}`;

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
  /** Si absent, chargé depuis AsyncStorage. */
  prefs?: KeyboardPrefs;
}

/**
 * Écrit les données marchand dans le stockage partagé du clavier.
 * Silencieux si le module natif n'est pas présent (ex: build sans le clavier).
 */
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
    await setMerchantData(data);
  } catch { /* module natif absent ou indisponible — ignoré */ }
}

/** Efface les données à la déconnexion. */
export async function clearKeyboard(): Promise<void> {
  try {
    await clearMerchantData();
  } catch { /* ignoré */ }
}
