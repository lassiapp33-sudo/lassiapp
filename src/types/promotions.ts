export type PromoType = 'pourcentage' | 'montant_fixe' | 'quantite_offerte' | 'prix_barre';
export type PromoCibleType = 'vitrine' | 'categorie' | 'produit';

export interface Promotion {
  id: string;
  shopId: string;
  titre: string;
  type: PromoType;
  valeur: number;
  cibleType: PromoCibleType;
  cibleId?: string;
  montantMin: number;
  dateDebut?: string; // ISO string
  dateFin?: string; // ISO string
  actif: boolean;
  createdAt: string;
}

/** Statut calculé d'une promo à un instant T. */
export interface PromoStatus {
  label: string;
  color: string;
}

export function getPromoStatus(promo: Promotion): PromoStatus {
  const now = new Date();
  if (!promo.actif) return { label: 'Inactive', color: '#5a5c80' };
  if (promo.dateFin && new Date(promo.dateFin) < now) return { label: 'Expirée', color: '#E07A7A' };
  if (promo.dateDebut && new Date(promo.dateDebut) > now)
    return { label: 'Programmée', color: '#5FD38A' };
  return { label: 'Active', color: '#5FD38A' };
}

/** Résumé d'une réduction applicable à un panier (calcul client-side, affichage uniquement). */
export interface AppliedDiscount {
  promoId: string;
  titre: string;
  type: PromoType;
  reductionFcfa: number;
  label: string; // ex: "−20% sur tout"
}

/** Info promo attachée à un product tile pour l'affichage vitrine. */
export interface ProductPromoInfo {
  badge: string; // ex: "−20%" ou "Promo"
  promoPrice?: number; // si prix_barre : nouveau prix
}
