import { supabase } from '../lib/supabase';
import { PayMethod } from '../types/payment';
import { retryWithBackoff } from '../utils/retry';
import useConnectionStore from '../store/connectionStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Section 10 — message clair en mode dégradé (pas de message technique brut)
const ERREUR_CONNEXION = 'Connexion impossible. Vérifie ton réseau et réessaie.';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: ANON_KEY,
  };
}

// ─── Créer une session de paiement Wave / Orange Money ───────────────────────

export interface PaymentSession {
  paymentUrl:  string;
  reference:   string;
  simulation?: boolean; // true en mode démo (sans clés API)
}

export async function createPayment(params: {
  ticketId:     string;
  amount:       number;
  method:       PayMethod;
  merchantName: string;
}): Promise<PaymentSession> {
  const idempotencyKey = `pay_${params.ticketId}`;
  // 'om' dans l'UI → 'orange_money' attendu par l'Edge Function
  const moyenPaiement = params.method === 'om' ? 'orange_money' : 'wave';

  let res: Response;
  try {
    res = await retryWithBackoff(async () =>
      fetch(`${FUNCTIONS_BASE}/create-payment`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          orderId: params.ticketId,
          moyenPaiement,
          idempotencyKey,
        }),
      }),
    );
  } catch {
    useConnectionStore.getState().setOffline(true);
    throw new Error(ERREUR_CONNEXION);
  }
  useConnectionStore.getState().setOffline(false);

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur de paiement');

  const redirectUrl = (data.redirectUrl ?? '') as string;
  return {
    paymentUrl:  redirectUrl,
    reference:   (data.paymentIntentId ?? '') as string,
    simulation:  data.mode === 'simulation',
  };
}

// ─── Vérifier si un paiement a été effectué ───────────────────────────────────

export async function verifyPayment(params: {
  reference: string;
  ticketId: string;
  method: PayMethod;
}): Promise<boolean> {
  let res: Response;
  try {
    res = await retryWithBackoff(async () =>
      fetch(`${FUNCTIONS_BASE}/verify-payment`, {
        method: 'POST',
        headers: await authHeaders(),
        // L'Edge Function attend paymentIntentId (= reference stockée après createPayment)
        body: JSON.stringify({ paymentIntentId: params.reference }),
      }),
    );
  } catch {
    useConnectionStore.getState().setOffline(true);
    throw new Error(ERREUR_CONNEXION);
  }
  useConnectionStore.getState().setOffline(false);

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur vérification');
  return data.confirmed === true;
}
