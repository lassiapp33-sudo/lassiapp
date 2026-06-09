import { supabase } from '../lib/supabase';
import { PayMethod } from '../types/payment';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey: ANON_KEY,
  };
}

// ─── Créer une session de paiement SenePay ────────────────────────────────────

export interface PaymentSession {
  paymentUrl: string;
  reference: string;
}

export async function createPayment(params: {
  ticketId: string;
  amount: number;
  method: PayMethod;
  merchantName: string;
}): Promise<PaymentSession> {
  const res = await fetch(`${FUNCTIONS_BASE}/create-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur de paiement');
  if (data.status === 'awaiting_keys') {
    throw new Error('Paiement mobile bientôt disponible. Les intégrations Wave et Orange Money sont en cours de finalisation.');
  }
  return data as unknown as PaymentSession;
}

// ─── Vérifier si un paiement a été effectué ───────────────────────────────────

export async function verifyPayment(params: {
  reference: string;
  ticketId: string;
  method: PayMethod;
}): Promise<boolean> {
  const res = await fetch(`${FUNCTIONS_BASE}/verify-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erreur vérification');
  return data.paid === true;
}
