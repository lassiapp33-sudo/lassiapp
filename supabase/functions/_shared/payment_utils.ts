// Utilitaires bancaires partagés — toutes les Edge Functions paiement
// Sync avec src/config/payment.ts côté client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Sb = ReturnType<typeof createClient>;

export const COMMISSION_RATE = 0.01;  // 1% — doit rester en sync avec PAYMENT_CONFIG
export const MONTANT_MIN     = 100;
export const MONTANT_MAX     = 5_000_000;

export type PaymentEventType =
  | 'create_initiated'
  | 'create_success'
  | 'create_failed'
  | 'verify_attempt'
  | 'verify_success'
  | 'verify_failed'
  | 'webhook_received'
  | 'idempotency_hit';

export interface PaymentLogEntry {
  event_type:         PaymentEventType;
  reference?:         string;
  ticket_id?:         string;
  user_id?:           string;
  amount?:            number;
  commission?:        number;
  method?:            string;
  provider?:          string;   // 'wave' | 'orange_money' | 'simulation'
  status:             string;   // 'initiated' | 'pending' | 'paid' | 'failed'
  provider_response?: unknown;
  metadata?:          unknown;
}

export function calculerCommission(prixBase: number): number {
  return Math.ceil(prixBase * COMMISSION_RATE);
}

export function validerMontant(montant: number): boolean {
  return Number.isInteger(montant) && montant >= MONTANT_MIN && montant <= MONTANT_MAX;
}

export function validerMethode(method: string): method is 'wave' | 'om' | 'orange_money' {
  return ['wave', 'om', 'orange_money'].includes(method);
}

// Écriture dans la table immuable payment_logs (INSERT only, jamais UPDATE/DELETE)
export async function logEvent(sb: Sb, entry: PaymentLogEntry): Promise<void> {
  try {
    await (sb as ReturnType<typeof createClient>).from('payment_logs').insert({
      ...entry,
      provider_response: entry.provider_response != null
        ? JSON.stringify(entry.provider_response)
        : null,
      metadata: entry.metadata != null
        ? JSON.stringify(entry.metadata)
        : null,
    });
  } catch (e) {
    // Les logs ne doivent jamais bloquer le flux principal
    console.error('[payment_log] insert failed:', e);
  }
}

// Vérifie si une clé d'idempotency existe encore valide (< 24h)
export async function checkIdempotency(
  sb: Sb,
  key: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await sb
    .from('payment_idempotency')
    .select('response')
    .eq('idempotency_key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return (data?.response as Record<string, unknown>) ?? null;
}

// Stocke le résultat d'une opération pour replay idempotent (TTL 24h)
export async function setIdempotency(
  sb: Sb,
  key: string,
  response: unknown,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await sb.from('payment_idempotency').upsert({
    idempotency_key: key,
    response,
    status: 'completed',
    expires_at: expiresAt,
  });
}
