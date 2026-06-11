// Section 10 — Retry intelligent avec backoff exponentiel.
// Réservé aux actions critiques (paiement) : on ne réessaie que les erreurs
// réseau (coupure, timeout) — jamais les erreurs métier (montant invalide,
// solde insuffisant…), qui doivent remonter immédiatement à l'utilisateur.

import { isNetworkError } from './network';
import logger from './logger';

export interface RetryOptions {
  /** Nombre de tentatives supplémentaires après l'essai initial (défaut 2). */
  retries?: number;
  /** Délai de base avant le 1er retry, en ms (défaut 500). */
  baseDelayMs?: number;
  /** Délai maximum entre deux tentatives, en ms (défaut 4000). */
  maxDelayMs?: number;
  /** Décide si une erreur donnée justifie un retry (défaut : isNetworkError). */
  shouldRetry?: (err: unknown) => boolean;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 4000,
    shouldRetry = isNetworkError,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitterMs = delay * (0.5 + Math.random() * 0.5);
      logger.warn(
        `[retry] tentative ${attempt + 1}/${retries} échouée, nouvel essai dans ${Math.round(jitterMs)}ms`,
        err,
      );
      await wait(jitterMs);
    }
  }
}
