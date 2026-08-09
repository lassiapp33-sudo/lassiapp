import { supabase, getCachedToken, safeGetSession } from '../lib/supabase';
import {
  BeautyTimeSlot,
  BeautyAppointment,
  BeautyRdvGerant,
  CreateBeautyAppointmentParams,
} from '../types/beautyAppointment';
import { VipPrestation } from '../types/vip';

// ─── Prestations disponibles d'un profil VIP (lecture publique) ──────────────

export const getVipPrestationsPublic = async (
  vipProfilId: string,
): Promise<VipPrestation[]> => {
  const { data, error } = await supabase
    .from('vip_prestations')
    .select('*')
    .eq('vip_profil_id', vipProfilId)
    .eq('disponible', true)
    .order('ordre');
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>): VipPrestation => ({
    id:           r.id as string,
    vipProfilId:  r.vip_profil_id as string,
    section:      (r.section as string) ?? 'Carte',
    nom:          r.nom as string,
    description:  (r.description as string) ?? null,
    prix:         Number(r.prix),
    prixBarre:    r.prix_barre != null ? Number(r.prix_barre) : null,
    unite:        (r.unite as string) ?? null,
    mention:      (r.mention as string) ?? null,
    estSignature: Boolean(r.est_signature),
    disponible:   Boolean(r.disponible),
    ordre:        Number(r.ordre ?? 0),
    createdAt:    r.created_at as string,
  }));
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const ANON_KEY     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

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

// ─── Créneaux disponibles pour une date (client) ─────────────────────────────

export const getBeautySlots = async (
  vipProfilId: string,
  date: string,
): Promise<BeautyTimeSlot[]> => {
  const { data, error } = await supabase.rpc('get_beauty_slots', {
    p_vip_profil_id: vipProfilId,
    p_date:          date,
  });
  if (error) throw error;
  return (data ?? []).map((r: {
    slot_id: string; label: string; heure_debut: string;
    heure_fin: string; dispo: number; max_resa: number;
  }): BeautyTimeSlot => ({
    id:               r.slot_id,
    vip_profil_id:    vipProfilId,
    label:            r.label,
    heure_debut:      r.heure_debut,
    heure_fin:        r.heure_fin,
    jours_semaine:    [],
    max_reservations: r.max_resa,
    actif:            true,
    position:         0,
    created_at:       '',
    dispo:            r.dispo,
  }));
};

// ─── Prendre un RDV (client → Edge Function) ──────────────────────────────────

export const createBeautyAppointment = async (
  params: CreateBeautyAppointmentParams,
): Promise<{ success: boolean; appointmentId: string }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-beauty-appointment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Erreur lors de la prise de RDV');
  }
  return json as { success: boolean; appointmentId: string };
};

// ─── Mes RDV (client) ─────────────────────────────────────────────────────────

export const getMyBeautyAppointments = async (): Promise<BeautyAppointment[]> => {
  const { data, error } = await supabase
    .from('beauty_appointments')
    .select('*')
    .order('date_rdv', { ascending: false })
    .order('heure_debut', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BeautyAppointment[];
};

// ─── Annuler un RDV (client) ──────────────────────────────────────────────────

export const cancelMyBeautyAppointment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('beauty_appointments')
    .update({ statut: 'annule', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// ─── RDV pour le gérant ───────────────────────────────────────────────────────

export const getBeautyRdvGerant = async (
  statut?: string,
): Promise<BeautyRdvGerant[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  const { data, error } = await supabase.rpc('get_beauty_appointments_gerant', {
    p_gerant_user_id: user.id,
    p_statut:         statut ?? null,
  });
  if (error) throw error;
  return (data ?? []) as BeautyRdvGerant[];
};

// ─── Traiter un RDV (gérant → Edge Function) ─────────────────────────────────

export const processBeautyAppointment = async (params: {
  appointmentId: string;
  action: 'confirmer' | 'refuser';
  messageGerant?: string;
}): Promise<{ success: boolean }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/process-beauty-appointment`, {
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

// ─── Créneaux du gérant (config) ─────────────────────────────────────────────

export const getAllBeautyTimeSlots = async (
  vipProfilId: string,
): Promise<BeautyTimeSlot[]> => {
  const { data, error } = await supabase
    .from('beauty_time_slots')
    .select('*')
    .eq('vip_profil_id', vipProfilId)
    .order('position')
    .order('heure_debut');
  if (error) throw error;
  return (data ?? []) as BeautyTimeSlot[];
};

export const upsertBeautyTimeSlot = async (
  slot: Partial<BeautyTimeSlot> & {
    vip_profil_id: string;
    label: string;
    heure_debut: string;
    heure_fin: string;
  },
): Promise<BeautyTimeSlot> => {
  const { data, error } = await supabase
    .from('beauty_time_slots')
    .upsert(slot, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data as BeautyTimeSlot;
};

export const deleteBeautyTimeSlot = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('beauty_time_slots')
    .update({ actif: false })
    .eq('id', id);
  if (error) throw error;
};
