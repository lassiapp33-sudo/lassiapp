// Section 10 — Détection des erreurs réseau (vs erreurs métier).
// Utilisé pour décider si une opération peut être réessayée (retry avec
// backoff) et si l'app doit basculer en mode dégradé (bandeau hors-ligne).

const NETWORK_ERROR_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /load failed/i,
  /timed? ?out/i,
  /aborterror/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /unable to resolve host/i,
];

/** True si `err` ressemble à une coupure réseau (pas une erreur métier). */
export function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message) return false;
  return NETWORK_ERROR_PATTERNS.some(pattern => pattern.test(message));
}
