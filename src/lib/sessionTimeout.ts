/**
 * sessionTimeout.ts — Déconnexion automatique après inactivité prolongée (Section 7).
 *
 * On ne stocke ici qu'un horodatage (aucune donnée sensible) : pas besoin de
 * SecureStore. Le flux est :
 *  - L'app passe en arrière-plan (AppState 'background'/'inactive') → on note l'heure.
 *  - L'app revient au premier plan, ou redémarre à froid → si le délai
 *    INACTIVITY_TIMEOUT_MS est dépassé, l'appelant déclenche une déconnexion
 *    complète (voir App.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// 30 minutes d'inactivité en arrière-plan → déconnexion automatique.
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const LAST_BACKGROUND_KEY = 'lassi-last-background-at';

// Note l'heure de mise en arrière-plan de l'app.
export async function markAppBackgrounded(): Promise<void> {
  await AsyncStorage.setItem(LAST_BACKGROUND_KEY, String(Date.now()));
}

// Efface la marque (l'app est revenue au premier plan dans les temps).
export async function clearBackgroundMark(): Promise<void> {
  await AsyncStorage.removeItem(LAST_BACKGROUND_KEY);
}

// true si l'app était en arrière-plan depuis plus de INACTIVITY_TIMEOUT_MS.
export async function hasInactivityTimeoutElapsed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LAST_BACKGROUND_KEY);
  if (!raw) return false;

  const elapsed = Date.now() - Number(raw);
  return elapsed >= INACTIVITY_TIMEOUT_MS;
}
