export function getErrorMessage(e: unknown, fallback = 'Une erreur est survenue.'): string {
  return e instanceof Error ? e.message : fallback;
}
