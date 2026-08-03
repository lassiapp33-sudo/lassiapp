export type TableReservationStatut =
  | 'en_attente'
  | 'acceptee'
  | 'alternative_proposee'
  | 'refusee'
  | 'arrivee'
  | 'terminee'
  | 'annulee';

export type TableReservationMotif =
  | 'anniversaire'
  | 'mariage'
  | 'fiancailles'
  | 'fete_surprise'
  | 'affaires'
  | 'romantique'
  | 'autre';

export type TableSpecialOption =
  | 'bougie'
  | 'emplacement_intime'
  | 'chaise_haute'
  | 'decoration_table';

export const MOTIF_LABEL: Record<TableReservationMotif, string> = {
  anniversaire:  'Anniversaire',
  mariage:       'Mariage',
  fiancailles:   'Fiançailles',
  fete_surprise: 'Fête surprise',
  affaires:      'Repas d\'affaires',
  romantique:    'Romantique',
  autre:         'Autre occasion',
};

export const MOTIF_EMOJI: Record<TableReservationMotif, string> = {
  anniversaire:  '🎂',
  mariage:       '💍',
  fiancailles:   '💎',
  fete_surprise: '🎉',
  affaires:      '💼',
  romantique:    '❤️',
  autre:         '✨',
};

export const OPTION_LABEL: Record<TableSpecialOption, string> = {
  bougie:             'Bougie romantique',
  emplacement_intime: 'Emplacement discret / intime',
  chaise_haute:       'Chaise haute pour enfant',
  decoration_table:   'Décoration de table spéciale',
};

export const OPTION_EMOJI: Record<TableSpecialOption, string> = {
  bougie:             '🕯️',
  emplacement_intime: '🔒',
  chaise_haute:       '👶',
  decoration_table:   '🌸',
};

export interface RestaurantSpace {
  id: string;
  vip_profil_id: string;
  nom: string;
  description?: string;
  photo_url?: string;
  capacite?: number;
  position: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTimeSlot {
  id: string;
  vip_profil_id: string;
  label: string;
  heure_debut: string; // "12:00"
  heure_fin: string;   // "14:00"
  jours_semaine: number[];
  actif: boolean;
  position: number;
  created_at: string;
}

export interface TableReservation {
  id: string;
  client_id: string;
  vip_profil_id: string;
  space_id?: string;
  time_slot_id?: string;
  date_reservation: string;
  heure_debut: string;
  nb_personnes: number;
  motif?: TableReservationMotif;
  details_motif?: string;
  options_speciales: TableSpecialOption[];
  statut: TableReservationStatut;
  acompte_montant: number;
  frais_service: number;
  montant_total: number;
  paiement_ref?: string;
  paiement_statut: string;
  paiement_methode?: string;
  message_gerant?: string;
  qr_code?: string;
  alt_space_id?: string;
  alt_date?: string;
  alt_heure_debut?: string;
  alt_message?: string;
  validee_a?: string;
  created_at: string;
  updated_at: string;
  // Relations optionnelles
  restaurant_spaces?: Pick<RestaurantSpace, 'nom' | 'photo_url'>;
  restaurant_time_slots?: Pick<RestaurantTimeSlot, 'label' | 'heure_debut' | 'heure_fin'>;
  vip_profils?: { nom_affiche: string };
}

// Paramètres envoyés à create-table-reservation
export interface CreateReservationParams {
  vipProfilId: string;
  spaceId?: string;
  timeSlotId?: string;
  dateReservation: string;  // YYYY-MM-DD
  heureDebut: string;       // HH:MM
  nbPersonnes: number;
  motif?: TableReservationMotif;
  detailsMotif?: string;
  optionsSpeciales?: TableSpecialOption[];
  moyenPaiement: 'wave' | 'orange_money';
}

export interface CreateReservationResult {
  success: boolean;
  mode: 'simulation' | 'production';
  reservationId: string;
  piId: string;
  redirectUrl: string | null;
  qrCode: string | null;
  montant: number;
}
