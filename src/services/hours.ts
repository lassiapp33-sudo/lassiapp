/**
 * services/hours.ts — Utilitaires pour les horaires d'ouverture hebdomadaires.
 * Calcule le statut ouvert/fermé en temps réel selon les horaires définis.
 */

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open:   string;   // "HH:MM"
  close:  string;   // "HH:MM"
  closed: boolean;  // vrai si ce jour est fermé toute la journée
}

export type WeekHours = Record<DayKey, DayHours>;

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lundi', tue: 'Mardi',  wed: 'Mercredi', thu: 'Jeudi',
  fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche',
};

export const DAY_SHORT: Record<DayKey, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu',
  fri: 'Ven', sat: 'Sam', sun: 'Dim',
};

// Correspondance JS Date.getDay() (0=Dim) → DayKey
const JS_DAY_TO_KEY: DayKey[] = ['sun','mon','tue','wed','thu','fri','sat'];

export const DEFAULT_WEEK_HOURS: WeekHours = {
  mon: { open: '07:00', close: '22:00', closed: false },
  tue: { open: '07:00', close: '22:00', closed: false },
  wed: { open: '07:00', close: '22:00', closed: false },
  thu: { open: '07:00', close: '22:00', closed: false },
  fri: { open: '07:00', close: '22:00', closed: false },
  sat: { open: '08:00', close: '20:00', closed: false },
  sun: { open: '09:00', close: '14:00', closed: true  },
};

export interface ShopStatus {
  isOpen:     boolean;
  label:      string;   // "Ouvert", "Fermé", "Exceptionnellement fermé"
  nextChange: string;   // "Ferme à 22h", "Ouvre à 7h", ""
}

/** Convertit "HH:MM" en minutes depuis minuit. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Formate "HH:MM" en "7h", "22h30", etc. */
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`;
}

/** Trouve la prochaine ouverture à partir du jour JS donné (0=Dim). */
function nextOpeningStr(hours: WeekHours, fromJsDay: number): string {
  for (let i = 1; i <= 7; i++) {
    const dayKey = JS_DAY_TO_KEY[(fromJsDay + i) % 7];
    const day    = hours[dayKey];
    if (!day.closed) {
      const label = i === 1 ? 'Demain' : DAY_LABELS[dayKey];
      return `Ouverture ${label} à ${formatHour(day.open)}`;
    }
  }
  return '';
}

/**
 * Calcule le statut ouvert/fermé en temps réel.
 * @param hours         Horaires hebdo (null = horaires non définis → ouvert par défaut)
 * @param manuallyClose true = override "exceptionnellement fermé"
 */
export function computeStatus(
  hours:         WeekHours | null,
  manuallyClose: boolean,
): ShopStatus {
  if (manuallyClose) {
    return { isOpen: false, label: 'Exceptionnellement fermé', nextChange: '' };
  }

  if (!hours) {
    return { isOpen: true, label: 'Ouvert', nextChange: '' };
  }

  const now      = new Date();
  const jsDay    = now.getDay();
  const todayKey = JS_DAY_TO_KEY[jsDay];
  const today    = hours[todayKey];

  if (today.closed) {
    return {
      isOpen: false,
      label: 'Fermé aujourd\'hui',
      nextChange: nextOpeningStr(hours, jsDay),
    };
  }

  const nowMin   = now.getHours() * 60 + now.getMinutes();
  const openMin  = toMinutes(today.open);
  const closeMin = toMinutes(today.close);

  if (nowMin >= openMin && nowMin < closeMin) {
    const remaining  = closeMin - nowMin;
    const nextChange = remaining <= 60
      ? `Ferme dans ${remaining}min`
      : `Ferme à ${formatHour(today.close)}`;
    return { isOpen: true, label: 'Ouvert', nextChange };
  }

  if (nowMin < openMin) {
    return {
      isOpen: false, label: 'Fermé',
      nextChange: `Ouverture aujourd'hui à ${formatHour(today.open)}`,
    };
  }

  // Après la fermeture du jour — cherche la prochaine ouverture
  return {
    isOpen: false, label: 'Fermé',
    nextChange: nextOpeningStr(hours, jsDay),
  };
}

/** Affiche les horaires d'un jour (ex: "7h – 22h" ou "Fermé"). */
export function formatDayHours(day: DayHours): string {
  if (day.closed) return 'Fermé';
  return `${formatHour(day.open)} – ${formatHour(day.close)}`;
}
