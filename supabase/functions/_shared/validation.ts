// ============================================================
// _shared/validation.ts
// Section 4 — Validation des entrées (anti-injection, anti-manipulation)
//
// Toute donnée reçue d'un client (body JSON, query, headers) est non fiable.
// Ces helpers fournissent des vérifications de TYPE, BORNES et FORMAT à
// appliquer avant d'utiliser une valeur dans une requête Supabase ou de la
// renvoyer/afficher.
//
// Règles :
//  - Montants FCFA  : entiers positifs uniquement, jamais de float.
//  - IDs            : UUID v4 stricts.
//  - Téléphones     : format sénégalais (+221 + 9 chiffres, préfixes 70/75/76/77/78).
//  - Strings libres : longueur bornée + (si affichées en HTML) échappées.
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Numéro sénégalais local : 9 chiffres, préfixes valides 70/75/76/77/78.
const PHONE_LOCAL_RE = /^7[05678][0-9]{7}$/;

// Numéro sénégalais international : +221 + 9 chiffres.
const PHONE_E164_RE = /^\+2217[05678][0-9]{7}$/;

/** Vérifie qu'une valeur est un UUID v4 (ou compatible) bien formé. */
export function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Numéro sénégalais stocké sans indicatif : "781376161". */
export function isSenegalPhoneLocal(v: unknown): v is string {
  return typeof v === 'string' && PHONE_LOCAL_RE.test(v);
}

/** Numéro sénégalais au format international : "+221781376161". */
export function isSenegalPhoneE164(v: unknown): v is string {
  return typeof v === 'string' && PHONE_E164_RE.test(v);
}

/**
 * Montant FCFA : entier strictement positif, jamais de virgule/float.
 * `max` borne les valeurs aberrantes (défaut : 100 000 000 FCFA).
 */
export function isPositiveInt(v: unknown, max = 100_000_000): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
}

/** Variante acceptant zéro (ex : remise, quantité offerte). */
export function isNonNegativeInt(v: unknown, max = 100_000_000): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

/**
 * Chaîne "sûre" : type string, longueur bornée, et (optionnel) restreinte à
 * un jeu de caractères donné via `pattern`.
 */
export function isSafeString(
  v: unknown,
  opts: { maxLen: number; minLen?: number; pattern?: RegExp } = { maxLen: 500 },
): v is string {
  if (typeof v !== 'string') return false;
  if (v.length > opts.maxLen) return false;
  if (opts.minLen !== undefined && v.length < opts.minLen) return false;
  if (opts.pattern && !opts.pattern.test(v)) return false;
  return true;
}

/** Vérifie qu'une valeur est bien un booléen (pas une string/0/1 à coercer). */
export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/** Vérifie qu'une valeur est une chaîne de date/heure ISO 8601 valide. */
export function isISODateString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v));
}

/**
 * Échappe les caractères spéciaux HTML — à appliquer systématiquement avant
 * d'interpoler une valeur utilisateur dans un template HTML (ex : email).
 */
export function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
