// ── Expo Module LASSI Keyboard — bridge JS ↔ stockage partagé natif ───────────
// Rôle UNIQUE de ce bridge : écrire les données marchand (lien vitrine, nom,
// réponses rapides, puces, fond) dans le stockage lisible par l'extension clavier
// (App Group sur iOS / SharedPreferences sur Android), et exposer l'état
// d'activation du clavier + l'ouverture des réglages clavier de l'OS.
//
// Le clavier (extension native) ne fait JAMAIS de réseau : il lit uniquement ce
// que l'app a écrit ici. Toute la synchro se fait côté app JS.

import LassiKeyboardModule from './src/LassiKeyboardModule';
import type { MerchantKeyboardData } from './src/LassiKeyboard.types';

export type { MerchantKeyboardData, QuickReply, KeyboardChip } from './src/LassiKeyboard.types';

/**
 * Écrit les données marchand dans le stockage partagé lu par le clavier.
 * À appeler à la connexion et à chaque mise à jour du profil/vitrine.
 */
export function setMerchantData(data: MerchantKeyboardData): Promise<void> {
  return LassiKeyboardModule.setMerchantData(JSON.stringify(data));
}

/** Efface les données (déconnexion). */
export function clearMerchantData(): Promise<void> {
  return LassiKeyboardModule.clearMerchantData();
}

/**
 * Indique si le clavier LASSI est activé dans les réglages de l'OS.
 * Android : fiable (lit la liste des IME activés).
 * iOS : non détectable de façon fiable → renvoie toujours null (inconnu).
 */
export function isKeyboardEnabled(): Promise<boolean | null> {
  return LassiKeyboardModule.isKeyboardEnabled();
}

/** Ouvre l'écran de réglages des claviers de l'OS (ajout/activation). */
export function openKeyboardSettings(): Promise<void> {
  return LassiKeyboardModule.openKeyboardSettings();
}

/**
 * Android uniquement : affiche le sélecteur de clavier (bascule rapide).
 * No-op sur iOS.
 */
export function showKeyboardPicker(): Promise<void> {
  return LassiKeyboardModule.showKeyboardPicker();
}
