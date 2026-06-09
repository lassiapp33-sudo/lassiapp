// ============================================================
// CONFIGURATION PAIEMENT LASSI — NE PAS MODIFIER SANS ACCORD
// ============================================================

export const PAYMENT_CONFIG = {
  // Commission LASSİ
  COMMISSION_RATE: 0.01,            // 1% exactement
  COMMISSION_PERCENT_DISPLAY: '1%', // pour affichage UI

  // Reçu
  RECEIPT_VALIDITY_MINUTES: 40,

  // Limites sécurité
  MONTANT_MIN_FCFA: 100,            // minimum acceptable
  MONTANT_MAX_FCFA: 5_000_000,      // 5 millions FCFA max par transaction

  // Moyens de paiement disponibles
  MOYENS_PAIEMENT: ['wave', 'orange_money'] as const,

  // Mode : 'simulation' (sans API) ou 'production' (avec API Wave/OM)
  MODE: (process.env.EXPO_PUBLIC_PAYMENT_MODE ?? 'simulation') as 'simulation' | 'production',

  // Frais Wave sur leur propre service (1% TTC, Wave prend sur ce qu'ils reçoivent)
  WAVE_FRAIS_RATE: 0.01,
} as const;

export type MoyenPaiement = typeof PAYMENT_CONFIG.MOYENS_PAIEMENT[number];

// ============================================================
// HELPERS DE CALCUL — SOURCE DE VÉRITÉ UNIQUE
// ============================================================

/**
 * Calcule le prix affiché au client (prix de base + commission LASSİ 1%)
 * @param prixBase - Prix entré par le prestataire (FCFA entier)
 * @returns Prix total affiché au client (arrondi au FCFA supérieur)
 */
export const calculerPrixClient = (prixBase: number): number => {
  if (!Number.isInteger(prixBase) || prixBase <= 0) return 0;
  const commission = Math.ceil(prixBase * PAYMENT_CONFIG.COMMISSION_RATE);
  return prixBase + commission;
};

/**
 * Calcule la commission LASSİ à partir du prix de base prestataire
 */
export const calculerCommission = (prixBase: number): number => {
  return Math.ceil(prixBase * PAYMENT_CONFIG.COMMISSION_RATE);
};

/**
 * Décompose un prix client en ses parties (validation côté serveur)
 */
export const decomposerPrix = (prixBase: number): {
  prixBase: number;
  commission: number;
  prixClient: number;
} => {
  const commission = calculerCommission(prixBase);
  return { prixBase, commission, prixClient: prixBase + commission };
};

/**
 * Valide qu'un montant est acceptable (sécurité)
 */
export const validerMontant = (montant: number): boolean => {
  return (
    Number.isInteger(montant) &&
    montant >= PAYMENT_CONFIG.MONTANT_MIN_FCFA &&
    montant <= PAYMENT_CONFIG.MONTANT_MAX_FCFA
  );
};
