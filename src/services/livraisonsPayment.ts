import { supabase } from '../lib/supabase';
import { PayMethod } from '../types/payment';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY      = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: ANON_KEY,
  };
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
  const res = await fetch(`${FUNCTIONS_URL}/create-livraison-payment`, {
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
  const res = await fetch(`${FUNCTIONS_URL}/verify-livraison-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ piId }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur vérification');

  return {
    paid:        data.paid as boolean,
    livraisonId: data.livraisonId as string | undefined,
  };
}
