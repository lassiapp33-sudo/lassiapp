const R = 6371; // rayon Terre en km

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Tarif livraison modèle Yango Sénégal (base + prix/km)
const BASE_FCFA = 500;
const PAR_KM_FCFA = 300;

export function calculerPrixLivraison(distanceKm: number): number {
  return Math.round(BASE_FCFA + PAR_KM_FCFA * distanceKm);
}
