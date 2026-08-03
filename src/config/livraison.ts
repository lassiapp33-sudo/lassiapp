// ============================================================
// TARIFS LIVRAISON LASSİ — modèle inspiré Yango Sénégal
// ⚠️ À AJUSTER selon les tarifs réels du terrain
// ============================================================

export const LIVRAISON_CONFIG = {
  PRIX_BASE: 600,            // FCFA — prise en charge
  PRIX_PAR_KM: 150,          // FCFA par km
  PRIX_MINIMUM: 800,         // FCFA — jamais en dessous
  PRIX_MAXIMUM: 15000,       // FCFA — plafond de sécurité
  DISTANCE_MAX_KM: 30,       // au-delà : livraison refusée
  FACTEUR_ROUTE: 1.3,        // +30% pour approcher la distance réelle
} as const;

export const distanceVolOiseau = (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number => {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const distanceEstimee = (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number => {
  const vol = distanceVolOiseau(lat1, lng1, lat2, lng2);
  return Math.round(vol * LIVRAISON_CONFIG.FACTEUR_ROUTE * 100) / 100;
};

export const calculerPrixLivraison = (distanceKm: number): number => {
  const brut = LIVRAISON_CONFIG.PRIX_BASE + distanceKm * LIVRAISON_CONFIG.PRIX_PAR_KM;
  const arrondi = Math.ceil(brut / 50) * 50;
  return Math.min(
    Math.max(arrondi, LIVRAISON_CONFIG.PRIX_MINIMUM),
    LIVRAISON_CONFIG.PRIX_MAXIMUM,
  );
};

export const devisLivraison = (
  departLat: number, departLng: number,
  arriveeLat: number, arriveeLng: number,
): { distanceKm: number; prix: number; horsZone: boolean; message: string | null } => {
  const distance = distanceEstimee(departLat, departLng, arriveeLat, arriveeLng);
  const horsZone = distance > LIVRAISON_CONFIG.DISTANCE_MAX_KM;
  return {
    distanceKm: distance,
    prix: horsZone ? 0 : calculerPrixLivraison(distance),
    horsZone,
    message: horsZone
      ? `Distance trop grande (${distance} km). Livraison indisponible au-delà de ${LIVRAISON_CONFIG.DISTANCE_MAX_KM} km.`
      : null,
  };
};
