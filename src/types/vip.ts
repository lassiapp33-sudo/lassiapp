export type VipCategorie =
  | 'restauration'
  | 'musculation_fitness'
  | 'boulangerie_patisserie'
  | 'beaute_tressage'
  | 'coiffure';

export type VipGabarit = 'palais' | 'maison';

export interface VipProfil {
  id: string;
  shopId: string;
  categorie: VipCategorie;
  initiale: string;
  nomAffiche: string;
  baseline: string | null;
  adresseCourte: string | null;
  motDuGerant: string | null;
  signatureMot: string | null;
  gabarit: VipGabarit;
  actif: boolean;
  updatedAt: string;
}

export interface VipPrestation {
  id: string;
  vipProfilId: string;
  section: string;
  nom: string;
  description: string | null;
  prix: number;
  prixBarre: number | null;
  unite: string | null;
  mention: string | null;
  estSignature: boolean;
  disponible: boolean;
  ordre: number;
  createdAt: string;
}

export interface VipHoraire {
  id: string;
  vipProfilId: string;
  jour: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  ouverture: string | null; // "HH:MM"
  fermeture: string | null;
  ferme: boolean;
  note: string | null;
}

export interface VipShopInfo {
  id: string;
  name: string;
  rating: number;
  reviewsCount: number;
  isManuallyClose: boolean;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface VipFiche {
  profil: VipProfil;
  prestations: VipPrestation[];
  horaires: VipHoraire[];
  shop: VipShopInfo;
}

export interface VipListeItem {
  vipProfilId: string;
  shopId: string;
  nomAffiche: string;
  baseline: string | null;
  adresseCourte: string | null;
  initiale: string;
  gabarit: VipGabarit;
  categorie: VipCategorie;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  estOuvert: boolean;
}

export const VIP_CATEGORIE_LABELS: Record<VipCategorie, string> = {
  restauration: 'Restauration',
  musculation_fitness: 'Fitness',
  boulangerie_patisserie: 'Boulangerie / Pâtisserie',
  beaute_tressage: 'Salon de beauté',
  coiffure: 'Coiffure',
};

export const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;
