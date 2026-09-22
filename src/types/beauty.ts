// Presets + catégories personnalisées (texte libre, colonne SQL = TEXT sans contrainte).
// (string & {}) garde l'autocomplétion des presets tout en autorisant n'importe quelle valeur.
export type BeautyCategorie = 'barber' | 'tresse' | 'ongle' | 'general' | (string & {});

export interface BeautyService {
  id: string;
  prestataire_id: string;
  nom: string;
  description: string | null;
  prix: number;             // prix base FCFA (sans marge LASSI)
  duree_minutes: number;
  categorie: BeautyCategorie;
  actif: boolean;
  created_at: string;
}

export interface BeautyReservation {
  id: string;
  client_id: string;
  prestataire_id: string;
  service_id: string;
  date_reservation: string;
  heure_debut: string;
  heure_fin: string;
  prix_total: number;
  commission_lassi: number;
  montant_prestataire: number;
  moyen_paiement: 'wave' | 'orange_money' | null;
  paiement_ref: string | null;
  statut: 'en_attente' | 'paye' | 'utilise' | 'expire' | 'annule';
  receipt_code: string | null;
  receipt_status: string | null;
  receipt_valid_until: string | null;
  payout_statut: 'pending' | 'ok' | 'erreur';
  created_at: string;
  client_name?: string | null;   // réservation invité web (sinon null → client via profil)
  client_phone?: string | null;
  beauty_services?: { nom: string; duree_minutes: number };
}

export interface CreneauBeauty {
  debut: string;
  fin: string;
}
