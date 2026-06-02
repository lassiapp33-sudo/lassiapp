/**
 * Utilitaires de formatage et validation des numéros sénégalais.
 *
 * Format affiché  : XX XXX XX XX  (ex : 78 137 61 61)
 * Format stocké   : 9 chiffres bruts  (ex : 781376161)
 * Format backend  : +221XXXXXXXXX  (ex : +221781376161)
 *
 * Préfixes valides en 2025 : 70 (Expresso), 75 (Free), 76 (Orange),
 *                             77 (Tigo/Free), 78 (Orange/Wave)
 */

/**
 * Formatte en live au fil de la frappe.
 * "781376161" → "78 137 61 61"
 */
export function formatPhoneSenegal(input: string): string {
  // Ne garder que les chiffres, limité à 9
  const d = input.replace(/\D/g, '').slice(0, 9);
  let out = '';
  if (d.length > 0) out += d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += ' ' + d.slice(5, 7);
  if (d.length > 7) out += ' ' + d.slice(7, 9);
  return out;
}

/**
 * Retire les espaces pour le stockage.
 * "78 137 61 61" → "781376161"
 */
export function cleanPhone(formatted: string): string {
  return formatted.replace(/\s/g, '');
}

/**
 * Ajoute l'indicatif pour le backend.
 * "78 137 61 61" → "+221781376161"
 */
export function getFullPhone(formatted: string): string {
  return '+221' + cleanPhone(formatted);
}

/**
 * Valide : 9 chiffres commençant par 70/75/76/77/78.
 */
export function isValidPhone(formatted: string): boolean {
  const digits = cleanPhone(formatted);
  return digits.length === 9 && /^7[05678]/.test(digits);
}

/** Message d'erreur standard. */
export const PHONE_ERROR = 'Numéro invalide — format attendu : 78 137 61 61';
