import * as Location from 'expo-location';

export interface Coords {
  latitude:  number;
  longitude: number;
}

// ─── Permission + GPS ─────────────────────────────────────────────────────────

/**
 * Demande la permission GPS et retourne les coordonnées de l'appareil.
 * Retourne null si la permission est refusée ou en cas d'erreur.
 */
export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

// ─── Géocodage inverse ────────────────────────────────────────────────────────

/**
 * Convertit des coordonnées GPS en nom de quartier/zone lisible.
 * Priorité : sous-région (quartier) → district → ville → région.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!result) return 'Ma position';
    return result.subregion ?? result.district ?? result.city ?? result.region ?? 'Ma position';
  } catch {
    return 'Ma position';
  }
}

// ─── Calculs de distance ─────────────────────────────────────────────────────

/** Distance haversine en mètres entre deux points GPS */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formate une distance en mètres en chaîne lisible ("250 m" ou "1.2 km") */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

/** Estimation du temps à pied (~12 min/km = 5 km/h) */
export function walkMinutes(meters: number): string {
  const min = Math.ceil((meters / 1000) * 12);
  return min < 1 ? '< 1 min' : `~${min} min à pied`;
}
