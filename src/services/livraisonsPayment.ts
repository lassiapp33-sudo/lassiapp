import { getCachedToken, safeGetSession } from '../lib/supabase';
import { PayMethod } from '../types/payment';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY      = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const FETCH_TIMEOUT_MS = 12_000;

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

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export interface LivraisonPaymentSession {
  piId:        string;
  lpId:        string;
  paymentUrl:  string | null;
  qrCode:      string | null;
  montant:     number;
  distanceKm:  number;
  simulation:  boolean;
}

export async function initierPaiementLivraison(params: {
  departLabel:  string; departLat:  number; departLng:  number;
  arriveeLabel: string; arriveeLat: number; arriveeLng: number;
  contactNom?:  string; contactTel?: string;
  method:       PayMethod;
}): Promise<LivraisonPaymentSession> {
  const moyenPaiement = params.method === 'om' ? 'orange_money' : 'wave';
  let res: Response;
  try {
    res = await fetchWithTimeout(`${FUNCTIONS_URL}/create-livraison-payment`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        departLabel:  params.departLabel,
        departLat:    params.departLat,
        departLng:    params.departLng,
        arriveeLabel: params.arriveeLabel,
        arriveeLat:   params.arriveeLat,
        arriveeLng:   params.arriveeLng,
        contactNom:   params.contactNom ?? null,
        contactTel:   params.contactTel ?? null,
        moyenPaiement,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Délai dépassé — vérifie ta connexion et réessaie');
    }
    throw new Error('Réseau indisponible — vérifie ta connexion');
  }

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || !data.success) {
    throw new Error((data.error as string) ?? 'Erreur paiement livraison');
  }

  return {
    piId:       data.piId as string,
    lpId:       data.lpId as string,
    paymentUrl: (data.redirectUrl as string | null) ?? null,
    qrCode:     (data.qrCode as string | null) ?? null,
    montant:    data.montant as number,
    distanceKm: data.distanceKm as number,
    simulation: data.mode === 'simulation',
  };
}

export async function verifierPaiementLivraison(
  piId: string,
): Promise<{ paid: boolean; livraisonId?: string }> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${FUNCTIONS_URL}/verify-livraison-payment`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ piId }),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Délai dépassé — vérifie ta connexion et réessaie');
    }
    throw new Error('Réseau indisponible — vérifie ta connexion');
  }

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur vérification');

  return {
    paid:        data.paid as boolean,
    livraisonId: data.livraisonId as string | undefined,
  };
}
