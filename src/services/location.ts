import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

// ─── Permission + GPS ─────────────────────────────────────────────────────────

/**
 * Demande la permission GPS et retourne les coordonnées de l'appareil.
 * Retourne null si la permission est refusée ou en cas d'erreur.
 */
export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    const permResult = await Promise.race([
      Location.requestForegroundPermissionsAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('perm_timeout')), 5000),
      ),
    ]);
    if (permResult.status !== 'granted') return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('gps_timeout')), 8000)),
    ]);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

// ─── Géocodage inverse ────────────────────────────────────────────────────────

/**
 * Convertit des coordonnées GPS en nom de quartier/zone lisible.
 * Nominatim OSM en priorité (suburb/neighbourhood = quartier précis ex: "Grand Mbao").
 * Fallback Expo Location si Nominatim échoue.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Nominatim — retourne le quartier précis (suburb > neighbourhood > city_district > city)
  try {
    const res = await Promise.race([
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr', 'User-Agent': 'LassiApp/1.0' } },
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    if (res.ok) {
      const data = await res.json() as { address?: Record<string, string> };
      const a = data.address ?? {};
      const zone =
        a.suburb ?? a.neighbourhood ?? a.city_district ?? a.town ?? a.city ?? a.county;
      if (zone) return zone;
    }
  } catch { /* fallback ci-dessous */ }

  // Fallback Expo Location
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!result) return 'Ma position';
    return result.district ?? result.subregion ?? result.city ?? result.region ?? 'Ma position';
  } catch {
    return 'Ma position';
  }
}

// ─── Calculs de distance ─────────────────────────────────────────────────────

/** Distance haversine en mètres entre deux points GPS */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formate une distance en mètres en chaîne lisible ("250 m" ou "1.2 km") */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Estimation du temps à pied (~12 min/km = 5 km/h) */
export function walkMinutes(meters: number): string {
  const min = Math.ceil((meters / 1000) * 12);
  return min < 1 ? '< 1 min' : `~${min} min à pied`;
}
