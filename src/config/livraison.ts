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

// ============================================================
// LIVRAISON MULTI-BOUTIQUES (panier multi-prestataire)
// ------------------------------------------------------------
// Le livreur récupère chez plusieurs boutiques puis livre le client.
// Règle métier (choix client) :
//   1. On choisit comme ANCRE la boutique dont le trajet vers le client est le
//      PLUS COURT → c'est le dernier retrait avant la livraison (leg de base).
//   2. Pour chaque autre boutique, on AJOUTE la distance de cette boutique vers
//      l'ancre (détour de ramassage).
//   3. distance totale = leg(ancre → client) + Σ leg(autre → ancre)
//      → une seule prise en charge (PRIX_BASE) + km cumulés.
// Ex : ancre A → client = trajet le plus court ; B → A ajouté par-dessus.
// ============================================================

export interface LivraisonShopPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface DevisLivraisonMulti {
  distanceKm: number;
  prix: number;
  horsZone: boolean;
  message: string | null;
  anchorId: string | null;
  legs: { id: string; label: string; distanceKm: number; role: 'base' | 'inter' }[];
}

export const devisLivraisonMulti = (
  shops: LivraisonShopPoint[],
  arriveeLat: number, arriveeLng: number,
): DevisLivraisonMulti => {
  const valid = shops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));

  if (valid.length === 0) {
    return { distanceKm: 0, prix: 0, horsZone: true, message: 'Position boutique indisponible.', anchorId: null, legs: [] };
  }

  // Une seule boutique → comportement identique au devis simple.
  if (valid.length === 1) {
    const d = devisLivraison(valid[0].lat, valid[0].lng, arriveeLat, arriveeLng);
    return {
      ...d,
      anchorId: valid[0].id,
      legs: [{ id: valid[0].id, label: valid[0].label, distanceKm: d.distanceKm, role: 'base' }],
    };
  }

  // Distance de chaque boutique vers le client
  const withDist = valid.map(s => ({
    ...s,
    distClient: distanceEstimee(s.lat, s.lng, arriveeLat, arriveeLng),
  }));

  // Ancre = boutique la plus proche du client (trajet le plus court)
  const anchor = withDist.reduce((a, b) => (b.distClient < a.distClient ? b : a));

  let totalDist = anchor.distClient;
  const legs: DevisLivraisonMulti['legs'] = [
    { id: anchor.id, label: anchor.label, distanceKm: anchor.distClient, role: 'base' },
  ];

  for (const s of withDist) {
    if (s.id === anchor.id) continue;
    const inter = distanceEstimee(s.lat, s.lng, anchor.lat, anchor.lng);
    totalDist += inter;
    legs.push({ id: s.id, label: s.label, distanceKm: inter, role: 'inter' });
  }

  totalDist = Math.round(totalDist * 100) / 100;
  const horsZone = totalDist > LIVRAISON_CONFIG.DISTANCE_MAX_KM;

  return {
    distanceKm: totalDist,
    prix: horsZone ? 0 : calculerPrixLivraison(totalDist),
    horsZone,
    message: horsZone
      ? `Distance totale trop grande (${totalDist} km). Livraison indisponible au-delà de ${LIVRAISON_CONFIG.DISTANCE_MAX_KM} km.`
      : null,
    anchorId: anchor.id,
    legs,
  };
};
