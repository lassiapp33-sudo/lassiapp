import { supabase, getCachedToken, safeGetSession } from '../lib/supabase';
import {
  RestaurantSpace,
  RestaurantTimeSlot,
  TableReservation,
  CreateReservationParams,
  CreateReservationResult,
} from '../types/tableReservation';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const ANON_KEY      = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  let token = getCachedToken();
  if (!token) {
    const { data: { session } } = await safeGetSession(15_000);
    token = session?.access_token ?? null;
  }
  if (!token) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey':        ANON_KEY,
  };
}

// ─── Espaces d'un restaurant ──────────────────────────────────────────────────

export const getRestaurantSpaces = async (vipProfilId: string): Promise<RestaurantSpace[]> => {
  const { data, error } = await supabase
    .from('restaurant_spaces')
    .select('*')
    .eq('vip_profil_id', vipProfilId)
    .eq('actif', true)
    .order('position');
  if (error) throw error;
  return (data ?? []) as RestaurantSpace[];
};

// Tous les espaces du gérant (actifs + inactifs) pour la page de config
export const getAllRestaurantSpaces = async (vipProfilId: string): Promise<RestaurantSpace[]> => {
  const { data, error } = await supabase
    .from('restaurant_spaces')
    .select('*')
    .eq('vip_profil_id', vipProfilId)
    .order('position');
  if (error) throw error;
  return (data ?? []) as RestaurantSpace[];
};

// ─── Créneaux disponibles pour une date ──────────────────────────────────────

export const getAvailableSlots = async (
  vipProfilId: string,
  date: string,
): Promise<RestaurantTimeSlot[]> => {
  const { data, error } = await supabase.rpc('get_reservation_slots', {
    p_vip_profil_id: vipProfilId,
    p_date:          date,
  });
  if (error) throw error;
  return (data ?? []).map((r: { slot_id: string; label: string; heure_debut: string; heure_fin: string }) => ({
    id:           r.slot_id,
    vip_profil_id: vipProfilId,
    label:        r.label,
    heure_debut:  r.heure_debut,
    heure_fin:    r.heure_fin,
    jours_semaine: [],
    actif:        true,
    position:     0,
    created_at:   '',
  })) as RestaurantTimeSlot[];
};

// ─── Créer une réservation + initier le paiement ─────────────────────────────

export const createTableReservation = async (
  params: CreateReservationParams,
): Promise<CreateReservationResult> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-table-reservation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Erreur lors de la réservation');
  }
  return json as CreateReservationResult;
};

// ─── Réservations du client ───────────────────────────────────────────────────

export const getMyTableReservations = async (): Promise<TableReservation[]> => {
  const { data, error } = await supabase
    .from('table_reservations')
    .select(`
      *,
      restaurant_spaces ( nom, photo_url ),
      restaurant_time_slots ( label, heure_debut, heure_fin ),
      vip_profils ( nom_affiche )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TableReservation[];
};

// ─── Réservations du gérant (dashboard restaurant) ───────────────────────────

export const getGerantReservations = async (
  statut?: string,
): Promise<{
  id: string;
  date_reservation: string;
  heure_debut: string;
  nb_personnes: number;
  motif: string;
  options_speciales: string[];
  statut: string;
  acompte_montant: number;
  created_at: string;
  space_nom: string;
  slot_label: string;
  client_nom: string;
  client_tel: string;
}[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  const { data, error } = await supabase.rpc('get_reservations_gerant', {
    p_gerant_user_id: user.id,
    p_statut:         statut ?? null,
  });
  if (error) throw error;
  return data ?? [];
};

// ─── Traiter une réservation (gérant) ────────────────────────────────────────

export const processTableReservation = async (params: {
  reservationId: string;
  action: 'accepter' | 'refuser' | 'proposer_alternative';
  messageGerant?: string;
  altSpaceId?: string;
  altDate?: string;
  altHeureDebut?: string;
  altMessage?: string;
}): Promise<{ success: boolean; action: string; qrCode?: string }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/process-table-reservation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Erreur lors du traitement');
  }
  return json;
};

// ─── Valider l'arrivée client (gérant scanne le QR) ─────────────────────────

export const validateTableArrival = async (
  qrCode: string,
): Promise<{
  success: boolean;
  nbPersonnes?: number;
  acompteADeduire?: number;
  motif?: string;
  options?: string[];
  message?: string;
}> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-table-arrival`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ qrCode }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Erreur validation');
  return json;
};

// ─── Annuler une réservation (client, seulement si en_attente) ────────────────

export const cancelMyReservation = async (reservationId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('table_reservations')
    .update({ statut: 'annulee', updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .in('statut', ['en_attente', 'alternative_proposee'])
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Cette réservation ne peut plus être annulée (déjà acceptée, refusée ou annulée).');
  }
};

// ─── Gestion des espaces (gérant) ────────────────────────────────────────────

export const upsertRestaurantSpace = async (
  space: Partial<RestaurantSpace> & { vip_profil_id: string; nom: string },
): Promise<RestaurantSpace> => {
  const { data, error } = await supabase
    .from('restaurant_spaces')
    .upsert(space, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data as RestaurantSpace;
};

export const deleteRestaurantSpace = async (spaceId: string): Promise<void> => {
  const { error } = await supabase
    .from('restaurant_spaces')
    .update({ actif: false })
    .eq('id', spaceId);
  if (error) throw error;
};

// Tous les créneaux du gérant (actifs + inactifs) pour la page de config
export const getRestaurantTimeSlots = async (vipProfilId: string): Promise<RestaurantTimeSlot[]> => {
  const { data, error } = await supabase
    .from('restaurant_time_slots')
    .select('*')
    .eq('vip_profil_id', vipProfilId)
    .order('position')
    .order('heure_debut');
  if (error) throw error;
  return (data ?? []) as RestaurantTimeSlot[];
};

// ─── Gestion des créneaux (gérant) ───────────────────────────────────────────

export const upsertTimeSlot = async (
  slot: Partial<RestaurantTimeSlot> & { vip_profil_id: string; label: string; heure_debut: string; heure_fin: string },
): Promise<RestaurantTimeSlot> => {
  const { data, error } = await supabase
    .from('restaurant_time_slots')
    .upsert(slot, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data as RestaurantTimeSlot;
};

export const deleteTimeSlot = async (slotId: string): Promise<void> => {
  const { error } = await supabase
    .from('restaurant_time_slots')
    .update({ actif: false })
    .eq('id', slotId);
  if (error) throw error;
};
