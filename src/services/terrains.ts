import { supabase, getCachedToken, safeGetSession } from '../lib/supabase';
import { Terrain, TerrainHoraire, CreneauPris, ReservationTerrain } from '../types/terrain';
import { PAYMENT_CONFIG } from '../config/payment';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ─── Helpers prix ─────────────────────────────────────────────────────────────

// Prestataire entre son prix de base → on ajoute 1% → prix affiché au client
export const calculerPrixAvecMarge = (prixBase: number): number =>
  prixBase + Math.ceil(prixBase * PAYMENT_CONFIG.COMMISSION_RATE);

// Extrait la commission LASSİ depuis le prix total payé par le client
export const calculerCommission = (prixTotal: number): number =>
  Math.ceil(prixTotal * PAYMENT_CONFIG.COMMISSION_RATE / (1 + PAYMENT_CONFIG.COMMISSION_RATE));

// ─── Terrains (vitrine client) ────────────────────────────────────────────────

export const getTerrains = async (sportType?: string): Promise<Terrain[]> => {
  let query = supabase
    .from('terrains')
    .select('*, horaires:terrain_horaires(*)')
    .eq('actif', true);
  if (sportType) query = query.eq('sport_type', sportType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Terrain[];
};

export const getTerrainById = async (terrainId: string): Promise<Terrain | null> => {
  const { data, error } = await supabase
    .from('terrains')
    .select('*, horaires:terrain_horaires(*)')
    .eq('id', terrainId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Terrain;
};

// ─── Terrains d'un prestataire (vitrine + gestion merchant) ──────────────────

export const getTerrainsByMerchant = async (prestataireId: string): Promise<Terrain[]> => {
  const { data, error } = await supabase
    .from('terrains')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Terrain[];
};

// ─── Horaires d'un terrain ────────────────────────────────────────────────────

export const getTerrainHoraires = async (terrainId: string): Promise<TerrainHoraire[]> => {
  const { data, error } = await supabase
    .from('terrain_horaires')
    .select('*')
    .eq('terrain_id', terrainId)
    .order('jour_semaine');
  if (error) throw error;
  return (data ?? []) as TerrainHoraire[];
};

// ─── Créneaux déjà pris (RPC temps réel) ─────────────────────────────────────

export const getCreneauxPris = async (
  terrainId: string,
  date: string,
): Promise<CreneauPris[]> => {
  const { data, error } = await supabase.rpc('get_crenaux_pris', {
    p_terrain_id: terrainId,
    p_date: date,
  });
  if (error) throw error;
  return (data ?? []) as CreneauPris[];
};

// ─── Helpers créneaux ─────────────────────────────────────────────────────────

export const genererCreneaux = (
  heureOuverture: string,
  heureFermeture: string,
  dureeMinutes = 60,
): { debut: string; fin: string }[] => {
  const creneaux: { debut: string; fin: string }[] = [];
  const [hO, mO] = heureOuverture.split(':').map(Number);
  const [hF, mF] = heureFermeture.split(':').map(Number);
  let cur = hO * 60 + mO;
  const end = hF * 60 + mF;

  while (cur + dureeMinutes <= end) {
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    creneaux.push({ debut: fmt(cur), fin: fmt(cur + dureeMinutes) });
    cur += dureeMinutes;
  }
  return creneaux;
};

export const isCreneauDisponible = (
  debut: string,
  fin: string,
  creneauxPris: CreneauPris[],
): boolean =>
  !creneauxPris.some(cp => !(fin <= cp.heure_debut || debut >= cp.heure_fin));

// ─── Créer une réservation (après paiement confirmé) ─────────────────────────

const genReceiptCode = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const createReservation = async (params: {
  clientId: string;
  terrainId: string;
  prestataireId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  prixTotal: number;
  moyenPaiement: 'wave' | 'orange_money';
  paiementRef: string;
}): Promise<ReservationTerrain> => {
  const commission = calculerCommission(params.prixTotal);
  const receiptValidUntil = new Date(
    `${params.date}T${params.heureFin}`,
  ).toISOString();

  const { data, error } = await supabase
    .from('reservations_terrain')
    .insert({
      client_id: params.clientId,
      terrain_id: params.terrainId,
      prestataire_id: params.prestataireId,
      date_reservation: params.date,
      heure_debut: params.heureDebut,
      heure_fin: params.heureFin,
      duree_heures: params.dureeHeures,
      prix_total: params.prixTotal,
      commission_lassi: commission,
      montant_prestataire: params.prixTotal - commission,
      moyen_paiement: params.moyenPaiement,
      paiement_ref: params.paiementRef,
      statut: 'paye',
      receipt_status: 'valide',
      receipt_code: genReceiptCode(),
      receipt_valid_until: receiptValidUntil,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReservationTerrain;
};

// ─── Mes réservations (client) ────────────────────────────────────────────────

export const getMyTerrainReservations = async (): Promise<ReservationTerrain[]> => {
  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = authData?.user ?? null;
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('reservations_terrain')
    .select('*, terrains(nom, sport_type, prix_horaire)')
    .eq('client_id', user.id)
    .order('date_reservation', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ReservationTerrain[];
};

// ─── Réservations du prestataire ──────────────────────────────────────────────

export const getMerchantTerrainReservations = async (
  prestataireId: string,
): Promise<ReservationTerrain[]> => {
  const { data, error } = await supabase
    .from('reservations_terrain')
    .select('*, terrains(nom, sport_type, prix_horaire)')
    .eq('prestataire_id', prestataireId)
    .order('date_reservation', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ReservationTerrain[];
};

export const getTerrainReservationsByDate = async (
  terrainId: string,
  date: string,
): Promise<ReservationTerrain[]> => {
  const { data, error } = await supabase
    .from('reservations_terrain')
    .select('*')
    .eq('terrain_id', terrainId)
    .eq('date_reservation', date)
    .order('heure_debut');
  if (error) throw error;
  return (data ?? []) as ReservationTerrain[];
};

// ─── Gestion terrain (prestataire) ───────────────────────────────────────────

export const saveTerrain = async (
  terrain: Partial<Omit<Terrain, 'created_at' | 'horaires'>> & { prestataire_id: string },
): Promise<Terrain> => {
  const { id, ...fields } = terrain;
  if (id) {
    const { data, error } = await supabase
      .from('terrains')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Terrain;
  }
  const { data, error } = await supabase.from('terrains').insert(fields).select().single();
  if (error) throw error;
  return data as Terrain;
};

export const saveTerrainHoraires = async (
  terrainId: string,
  horaires: Omit<TerrainHoraire, 'id' | 'terrain_id'>[],
): Promise<void> => {
  const rows = horaires.map(h => ({ ...h, terrain_id: terrainId }));
  const { error } = await supabase
    .from('terrain_horaires')
    .upsert(rows, { onConflict: 'terrain_id,jour_semaine' });
  if (error) throw error;
};

// ─── Vérification QR (prestataire) ───────────────────────────────────────────

export const verifyTerrainReceipt = async (
  receiptCode: string,
  _prestataireId: string,
): Promise<{
  success: boolean;
  error?: string;
  client_id?: string;
  terrain_id?: string;
  heure_debut?: string;
  heure_fin?: string;
  date_reservation?: string;
}> => {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-terrain-receipt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ receiptCode: receiptCode.toUpperCase() }),
  });
  const data = await res.json() as Record<string, unknown>;
  return data as { success: boolean; error?: string; client_id?: string; terrain_id?: string; heure_debut?: string; heure_fin?: string; date_reservation?: string };
};

// ─── Vérification paiement via Edge Function ──────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  let token = getCachedToken();
  if (!token) {
    const { data: { session } } = await safeGetSession(15_000);
    token = session?.access_token ?? null;
  }
  if (!token) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: ANON_KEY,
  };
}

// Ancien flux (basket) : vérifie uniquement, ne met pas à jour la DB
export const verifyTerrainPayment = async (params: {
  reference: string;
  method: 'wave' | 'orange_money';
}): Promise<boolean> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-terrain-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Erreur vérification');
  return (data as { paid?: boolean }).paid === true;
};

// ─── Flux terrain football (pre-réservation → paiement → confirmation) ────────

export const createPendingReservation = async (params: {
  clientId: string;
  terrainId: string;
  prestataireId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  prixTotal: number;
}): Promise<ReservationTerrain> => {
  const commission = calculerCommission(params.prixTotal);
  const { data, error } = await supabase
    .from('reservations_terrain')
    .insert({
      client_id:           params.clientId,
      terrain_id:          params.terrainId,
      prestataire_id:      params.prestataireId,
      date_reservation:    params.date,
      heure_debut:         params.heureDebut,
      heure_fin:           params.heureFin,
      duree_heures:        params.dureeHeures,
      prix_total:          params.prixTotal,
      commission_lassi:    commission,
      montant_prestataire: params.prixTotal - commission,
      statut:              'en_attente',
    })
    .select()
    .single();

  if (error) {
    // Code 23P01 = exclusion_violation (EXCLUDE constraint PostgreSQL).
    // Si c'est une ancienne réservation en_attente du MÊME client sur ce créneau,
    // on la réutilise au lieu d'afficher une erreur générique.
    const isExclusion = (error.code === '23P01') ||
      (error.message ?? '').toLowerCase().includes('exclusion') ||
      (error.message ?? '').toLowerCase().includes('overlap');
    if (isExclusion) {
      const { data: existing } = await supabase
        .from('reservations_terrain')
        .select()
        .eq('client_id', params.clientId)
        .eq('terrain_id', params.terrainId)
        .eq('date_reservation', params.date)
        .eq('heure_debut', params.heureDebut)
        .eq('statut', 'en_attente')
        .maybeSingle();
      if (existing) return existing as ReservationTerrain;
      // Pas de réservation à réutiliser → créneau pris par un autre client
    }
    throw error;
  }
  return data as ReservationTerrain;
};

export const cancelPendingReservation = async (reservationId: string): Promise<void> => {
  const { error } = await supabase
    .from('reservations_terrain')
    .update({ statut: 'annule' })
    .eq('id', reservationId)
    .eq('statut', 'en_attente');
  if (error) console.warn('[terrains] cancelPendingReservation:', error.message);
};

export const createTerrainPaymentSession = async (params: {
  reservationId: string;
  moyenPaiement: 'wave' | 'orange_money';
}): Promise<{ reference: string; paymentUrl: string | null; qrCode?: string | null; simulation: boolean }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-terrain-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string | undefined) ?? "Impossible d'initier le paiement");
  return data as { reference: string; paymentUrl: string | null; qrCode?: string | null; simulation: boolean };
};

export const verifyTerrainPaymentById = async (params: {
  reference: string;
  reservationId: string;
  method: 'wave' | 'orange_money';
}): Promise<{ paid: boolean; receiptCode?: string }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-terrain-payment`, {
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
