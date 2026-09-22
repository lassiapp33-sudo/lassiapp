// Filtrage temps réel des créneaux : masque les heures déjà passées quand la
// date sélectionnée est aujourd'hui. Réutilisé par toutes les réservations
// (restaurant, beauté, terrain/sport) pour un comportement identique.

/** Date locale de l'appareil au format YYYY-MM-DD. */
export function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** true si dateStr (YYYY-MM-DD) correspond à aujourd'hui (heure locale). */
export function isToday(dateStr?: string): boolean {
  return !!dateStr && dateStr === todayStr();
}

/** Minutes écoulées depuis minuit (heure locale). */
export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** "HH:MM" ou "HH:MM:SS" -> minutes depuis minuit. */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Retire les créneaux dont l'heure de début est déjà passée lorsque `dateStr`
 * est aujourd'hui. Sinon renvoie la liste inchangée.
 * @param slots     liste de créneaux
 * @param getDebut  extrait l'heure de début "HH:MM(:SS)" d'un créneau
 * @param dateStr   date sélectionnée au format YYYY-MM-DD
 */
export function filtrerCreneauxPasses<T>(
  slots: T[],
  getDebut: (s: T) => string,
  dateStr?: string,
): T[] {
  if (!isToday(dateStr)) return slots;
  const nowM = nowMinutes();
  return slots.filter(s => hhmmToMin(getDebut(s)) > nowM);
}
