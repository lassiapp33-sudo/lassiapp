// Types du module Ma Vitrine (prestataire)

import { ShopType }  from '../config/categories';
import { WeekHours } from '../services/hours';

export type StockStatus = 'in' | 'out';

/** Période d'une formule d'abonnement (salles de sport). */
export type FormulaPeriod =
  | 'seance' | 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export const FORMULA_PERIOD_LABELS: Record<FormulaPeriod, string> = {
  seance:    'Séance',
  jour:      'Par jour',
  semaine:   'Par semaine',
  mois:      'Par mois',
  trimestre: 'Trimestre',
  annee:     'Par an',
};

export interface StoreCategory {
  id:    string;
  label: string;
  emoji: string;
}

export interface StoreProduct {
  id:        string;
  emoji:     string;       // emoji de fallback si pas de photo
  photoUrl?: string;       // URL Supabase Storage
  name:      string;
  desc:      string;
  price:     number;
  category:  string;       // id de StoreCategory
  stock:     StockStatus;
  /** Type d'item : suit le shop_type du commerce. */
  itemType:  'product' | 'service' | 'membership';
  /** Durée estimée en minutes (uniquement pour 'service'). */
  duration?: number;
  /** Période de la formule (uniquement pour 'membership'). */
  formulaPeriod?: FormulaPeriod;
}

export interface StoreProfile {
  initial:      string;
  name:         string;
  subtitle:     string;
  description?: string;
  addressText?: string;
  phone?:       string;
  isOpen:       boolean;
  logoUrl?:     string;
  coverUrl?:    string;
  isVip?:       boolean;
}

/** Contexte vitrine enrichi stocké dans shopStore. */
export interface ShopContext {
  shopType:        ShopType;
  openingHours:    WeekHours | null;
  isManuallyClose: boolean;
  galleryUrls:     string[];
}
