import { supabase, getValidToken } from '../lib/supabase';
import { BeautyService, BeautyReservation, CreneauBeauty } from '../types/beauty';
import { PAYMENT_CONFIG } from '../config/payment';
import { filtrerCreneauxPasses } from '../utils/slotTime';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Prix ─────────────────────────────────────────────────────────────────────

export const calculerPrixBeauteAvecMarge = (prixBase: number): number =>
  prixBase + Math.ceil(prixBase * PAYMENT_CONFIG.COMMISSION_RATE);

export const calculerCommissionBeaute = (prixTotal: number): number =>
  Math.ceil(prixTotal * PAYMENT_CONFIG.COMMISSION_RATE / (1 + PAYMENT_CONFIG.COMMISSION_RATE));

// ─── Services (catalogue prestataire) ─────────────────────────────────────────

export const getBeautyServices = async (prestataireId: string): Promise<BeautyService[]> => {
  const { data, error } = await supabase
    .from('beauty_services')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .eq('actif', true)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as BeautyService[];
};

export const getBeautyServicesByMerchant = async (prestataireId: string): Promise<BeautyService[]> => {
  const { data, error } = await supabase
    .from('beauty_services')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as BeautyService[];
};

export const saveBeautyService = async (
  service: Partial<Omit<BeautyService, 'created_at'>> & { prestataire_id: string },
): Promise<BeautyService> => {
  const { id, ...fields } = service;
  if (id) {
    const { data, error } = await supabase
      .from('beauty_services')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as BeautyService;
  }
  const { data, error } = await supabase
    .from('beauty_services')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data as BeautyService;
};

export const deleteBeautyService = async (serviceId: string): Promise<void> => {
  const { error } = await supabase
    .from('beauty_services')
    .update({ actif: false })
    .eq('id', serviceId);
  if (error) throw error;
};

// ─── Créneaux ─────────────────────────────────────────────────────────────────

export const getCreneauxPrisBeaute = async (
  prestataireId: string,
  date: string,
): Promise<CreneauBeauty[]> => {
  const { data, error } = await supabase.rpc('get_beauty_creneaux_pris', {
    p_prestataire_id: prestataireId,
    p_date: date,
  });
  if (error) throw error;
  return (data ?? []) as CreneauBeauty[];
};

export const genererCreneauxBeaute = (
  heureOuverture: string,
  heureFermeture: string,
  dureeMinutes: number,
  date?: string, // YYYY-MM-DD : masque les créneaux passés si === aujourd'hui
): CreneauBeauty[] => {
  const creneaux: CreneauBeauty[] = [];
  const [hO, mO] = heureOuverture.split(':').map(Number);
  const [hF, mF] = heureFermeture.split(':').map(Number);
  let cur = hO * 60 + mO;
  const end = hF * 60 + mF;
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  while (cur + dureeMinutes <= end) {
    creneaux.push({ debut: fmt(cur), fin: fmt(cur + dureeMinutes) });
    cur += dureeMinutes;
  }
  return filtrerCreneauxPasses(creneaux, c => c.debut, date);
};

export const isCreneauBeauteDisponible = (
  debut: string,
  fin: string,
  creneauxPris: CreneauBeauty[],
): boolean =>
  !creneauxPris.some(cp => !(fin <= cp.debut || debut >= cp.fin));

// ─── Réservations ─────────────────────────────────────────────────────────────

function genReceiptCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const createBeautyPendingReservation = async (params: {
  clientId: string;
  prestataireId: string;
  serviceId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  prixTotal: number;
}): Promise<BeautyReservation> => {
  const commission = calculerCommissionBeaute(params.prixTotal);
  const { data, error } = await supabase
    .from('beauty_reservations')
    .insert({
      client_id:           params.clientId,
      prestataire_id:      params.prestataireId,
      service_id:          params.serviceId,
      date_reservation:    params.date,
      heure_debut:         params.heureDebut,
      heure_fin:           params.heureFin,
      prix_total:          params.prixTotal,
      commission_lassi:    commission,
      montant_prestataire: params.prixTotal - commission,
      statut:              'en_attente',
    })
    .select()
    .single();

  if (error) {
    const isExclusion = (error.code === '23P01') ||
      (error.message ?? '').toLowerCase().includes('exclusion') ||
      (error.message ?? '').toLowerCase().includes('overlap');
    if (isExclusion) {
      const { data: existing } = await supabase
        .from('beauty_reservations')
        .select()
        .eq('client_id', params.clientId)
        .eq('prestataire_id', params.prestataireId)
        .eq('date_reservation', params.date)
        .eq('heure_debut', params.heureDebut)
        .eq('statut', 'en_attente')
        .maybeSingle();
      if (existing) return existing as BeautyReservation;
    }
    throw error;
  }
  return data as BeautyReservation;
};

export const cancelBeautyPendingReservation = async (reservationId: string): Promise<void> => {
  const { error } = await supabase
    .from('beauty_reservations')
    .update({ statut: 'annule' })
    .eq('id', reservationId)
    .eq('statut', 'en_attente');
  if (error) console.warn('[beauty] cancelPending:', error.message);
};

// ─── Edge Functions ────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: ANON_KEY,
  };
}

export const createBeautyPaymentSession = async (params: {
  reservationId: string;
  moyenPaiement: 'wave' | 'orange_money';
}): Promise<{ reference: string; paymentUrl: string | null; qrCode?: string | null; simulation: boolean }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-beauty-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string | undefined) ?? "Impossible d'initier le paiement");
  return data as { reference: string; paymentUrl: string | null; qrCode?: string | null; simulation: boolean };
};

export const verifyBeautyPaymentById = async (params: {
  reference: string;
  reservationId: string;
  method: 'wave' | 'orange_money';
}): Promise<{ paid: boolean; receiptCode?: string }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-beauty-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string | undefined) ?? 'Erreur vérification paiement');
  return {
    paid:        data.paid === true,
    receiptCode: data.receipt_code as string | undefined,
  };
};

export const verifyBeautyReceipt = async (receiptCode: string): Promise<{
  success: boolean;
  error?: string;
  client_id?: string;
  service_id?: string;
  heure_debut?: string;
  heure_fin?: string;
  date_reservation?: string;
}> => {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-beauty-receipt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ receiptCode: receiptCode.toUpperCase() }),
  });
  const data = await res.json() as Record<string, unknown>;
  return data as { success: boolean; error?: string; client_id?: string; service_id?: string; heure_debut?: string; heure_fin?: string; date_reservation?: string };
};

// ─── Réservations client ──────────────────────────────────────────────────────

export const getMyBeautyReservations = async (): Promise<BeautyReservation[]> => {
  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = authData?.user ?? null;
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('beauty_reservations')
    .select('*, beauty_services(nom, duree_minutes)')
    .eq('client_id', user.id)
    .order('date_reservation', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as BeautyReservation[];
};

// ─── Réservations prestataire ─────────────────────────────────────────────────

export const getBeautyReservationsByDate = async (
  prestataireId: string,
  date: string,
): Promise<BeautyReservation[]> => {
  const { data, error } = await supabase
    .from('beauty_reservations')
    .select('*, beauty_services(nom, duree_minutes)')
    .eq('prestataire_id', prestataireId)
    .eq('date_reservation', date)
    .order('heure_debut');
  if (error) throw error;
  return (data ?? []) as BeautyReservation[];
};
