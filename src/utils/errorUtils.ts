import { Alert } from 'react-native';

export function getErrorMessage(e: unknown, fallback = 'Une erreur est survenue.'): string {
  return e instanceof Error ? e.message : fallback;
}

/** Affiche une alerte d'erreur en français. Point d'entrée unique pour migrer vers un toast si besoin. */
export function notifyError(msg: string): void {
  Alert.alert('Erreur', msg);
}
