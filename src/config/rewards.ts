// ============================================================
// CONFIG RÉCOMPENSES LASSI — modifiable facilement
// ============================================================

// --- Paliers du classement MONDIAL (mensuel, top 40) ---
export interface PalierRecompense {
  rangMin: number;
  rangMax: number;
  badge: string; // libellé du badge
  certificat: boolean; // certificat partageable
  prioriteRecherche: boolean;
  notifVille: boolean;
  creditLassi: number; // FCFA de crédit interne
  carrouselProduits: number; // nb produits dans Offre di Quartier (0 = pas d'accès)
  newsletter: boolean;
}

export const PALIERS_MONDIAL: PalierRecompense[] = [
  {
    rangMin: 1,
    rangMax: 1,
    badge: '👑 Champion Mondial',
    certificat: true,
    prioriteRecherche: true,
    notifVille: true,
    creditLassi: 5000,
    carrouselProduits: 5,
    newsletter: true,
  },
  {
    rangMin: 2,
    rangMax: 2,
    badge: '🥈 Vice-Champion',
    certificat: true,
    prioriteRecherche: true,
    notifVille: true,
    creditLassi: 3000,
    carrouselProduits: 4,
    newsletter: true,
  },
  {
    rangMin: 3,
    rangMax: 3,
    badge: '🥉 3e Mondial',
    certificat: true,
    prioriteRecherche: true,
    notifVille: true,
    creditLassi: 2000,
    carrouselProduits: 3,
    newsletter: true,
  },
  {
    rangMin: 4,
    rangMax: 4,
    badge: '🏅 Top 4 Mondial',
    certificat: true,
    prioriteRecherche: true,
    notifVille: false,
    creditLassi: 1000,
    carrouselProduits: 2,
    newsletter: false,
  },
  {
    rangMin: 5,
    rangMax: 5,
    badge: '🏅 Top 5 Mondial',
    certificat: true,
    prioriteRecherche: true,
    notifVille: false,
    creditLassi: 1000,
    carrouselProduits: 1,
    newsletter: false,
  },
  {
    rangMin: 6,
    rangMax: 10,
    badge: '⭐ Top 10 Mondial',
    certificat: true,
    prioriteRecherche: true,
    notifVille: false,
    creditLassi: 500,
    carrouselProduits: 0,
    newsletter: false,
  },
  {
    rangMin: 11,
    rangMax: 20,
    badge: '📈 Top 20 Mondial',
    certificat: true,
    prioriteRecherche: false,
    notifVille: false,
    creditLassi: 0,
    carrouselProduits: 0,
    newsletter: false,
  },
  {
    rangMin: 21,
    rangMax: 40,
    badge: '📋 Top 40 Mondial',
    certificat: false,
    prioriteRecherche: false,
    notifVille: false,
    creditLassi: 0,
    carrouselProduits: 0,
    newsletter: false,
  },
];

// --- Récompense SOUS-CATÉGORIE (hebdo) ---
export const RECOMPENSE_SOUS_CATEGORIE = {
  // Top 3 de chaque sous-catégorie → Top VIP podium pendant 1 semaine
  topVipRangs: [1, 2, 3],
  dureeJours: 7,
  badges: {
    1: '🏆 Champion de la semaine',
    2: '🥈 2e de la semaine',
    3: '🥉 3e de la semaine',
  } as Record<number, string>,
};

// --- Récompense CLIENTS ---
export const RECOMPENSE_CLIENT = {
  topClientsAffiches: 10,
  badgeSupporter: '🎖️ Supporter n°1',
};

// --- Récompense BIENVENUE (nouveau compte prestataire) ---
// Attribuée automatiquement par le trigger trg_profiles_recompense_bienvenue
// (20260612160000_recompense_bienvenue.sql).
export const RECOMPENSE_BIENVENUE = {
  carrouselProduits: 4,
  badge: '🎁 Bienvenue sur LASSI',
};

// --- Helper : trouver le palier d'un rang mondial ---
export const getPalierMondial = (rang: number): PalierRecompense | null => {
  return PALIERS_MONDIAL.find(p => rang >= p.rangMin && rang <= p.rangMax) ?? null;
};

// --- Périodes ---
export const CLASSEMENT_CONFIG = {
  MONDIAL_TOP: 40,
  SOUS_CATEGORIE_TOP: 20, // on affiche top 20 par sous-catégorie
  CARROUSEL_MAX_PRESTATAIRES: 5, // SEULEMENT les 5 premiers du mondial
  QUARTIERS_TOP: 10,
};
