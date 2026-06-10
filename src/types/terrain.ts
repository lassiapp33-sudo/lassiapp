export type SportType = 'football' | 'basketball' | 'tennis' | 'volleyball' | 'autre';

export const SPORT_EMOJI: Record<SportType, string> = {
  football: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  volleyball: '🏐',
  autre: '🏟️',
};

export const SPORT_LABEL: Record<SportType, string> = {
  football: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  volleyball: 'Volleyball',
  autre: 'Autre sport',
};

export interface Terrain {
  id: string;
  prestataire_id: string;
  nom: string;
  description?: string;
  images: string[];
  prix_horaire: number; // FCFA, prix de base prestataire (le client paie ce prix + 1% commission LASSİ)
  sport_type: SportType;
  capacite: number;
  adresse?: string;
  latitude?: number;
  longitude?: number;
  actif: boolean;
  created_at: string;
  // Relations
  horaires?: TerrainHoraire[];
}

export interface TerrainHoraire {
  id: string;
  terrain_id: string;
  jour_semaine: number; // 0-6
  heure_ouverture: string; // "08:00"
  heure_fermeture: string; // "22:00"
  ferme: boolean;
}

export interface CreneauPris {
  heure_debut: string; // "10:00"
  heure_fin: string;   // "11:00"
}

export interface ReservationTerrain {
  id: string;
  client_id: string;
  terrain_id: string;
  prestataire_id: string;
  date_reservation: string; // "2026-06-15"
  heure_debut: string;
  heure_fin: string;
  duree_heures: number;
  prix_total: number;
  commission_lassi: number;
  montant_prestataire: number;
  moyen_paiement: 'wave' | 'orange_money';
  receipt_code: string;
  receipt_valid_until: string;
  receipt_status: 'pending' | 'valide' | 'utilise' | 'expire';
  statut: 'en_attente' | 'paye' | 'utilise' | 'expire' | 'annule';
  // Jointure optionnelle depuis les requêtes avec select('*, terrains(...)')
  terrains?: Pick<Terrain, 'nom' | 'sport_type' | 'prix_horaire'>;
}
