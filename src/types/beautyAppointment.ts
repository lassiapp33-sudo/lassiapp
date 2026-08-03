export type BeautyAppointmentStatut =
  | 'en_attente'
  | 'confirme'
  | 'refuse'
  | 'annule'
  | 'termine';

export interface BeautyTimeSlot {
  id: string;
  vip_profil_id: string;
  label: string;
  heure_debut: string;  // "HH:MM"
  heure_fin: string;
  jours_semaine: number[];
  max_reservations: number;
  actif: boolean;
  position: number;
  created_at: string;
  // enrichi par RPC
  dispo?: number;
}

export interface BeautyAppointment {
  id: string;
  client_id: string;
  vip_profil_id: string;
  time_slot_id: string | null;
  prestation_nom: string | null;
  date_rdv: string;       // "YYYY-MM-DD"
  heure_debut: string;    // "HH:MM"
  heure_fin: string | null;
  note_client: string | null;
  statut: BeautyAppointmentStatut;
  message_gerant: string | null;
  created_at: string;
  updated_at: string;
}

// Retour du RPC get_beauty_appointments_gerant
export interface BeautyRdvGerant {
  id: string;
  date_rdv: string;
  heure_debut: string;
  heure_fin: string | null;
  prestation_nom: string | null;
  note_client: string | null;
  statut: BeautyAppointmentStatut;
  message_gerant: string | null;
  created_at: string;
  client_nom: string;
  client_tel: string | null;
}

export interface CreateBeautyAppointmentParams {
  vipProfilId: string;
  timeSlotId: string;
  dateRdv: string;        // "YYYY-MM-DD"
  heureDebut: string;     // "HH:MM"
  heureFin?: string;
  prestationNom?: string;
  noteClient?: string;
}

export const STATUT_LABEL_BEAUTY: Record<BeautyAppointmentStatut, string> = {
  en_attente: 'En attente',
  confirme:   'Confirmé',
  refuse:     'Refusé',
  annule:     'Annulé',
  termine:    'Terminé',
};

export const STATUT_COLOR_BEAUTY: Record<BeautyAppointmentStatut, string> = {
  en_attente: '#F5C842',
  confirme:   '#7FCF9C',
  refuse:     '#E55C5C',
  annule:     '#8E93AB',
  termine:    '#8E93AB',
};
