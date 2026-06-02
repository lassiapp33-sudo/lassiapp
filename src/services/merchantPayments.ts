import { supabase } from '../lib/supabase';
import {
  MerchantPayment, MerchantPayMethod,
  PaymentStats, DayRevenue,
} from '../types/merchantPayments';

// ─── Mapping ──────────────────────────────────────────────────────────────────

function rowToPayment(row: Record<string, any>): MerchantPayment {
  const client = (row.client as Record<string, any> | null) ?? {};
  const order  = (row.order  as Record<string, any> | null) ?? {};
  const items  = Array.isArray(row.items)       ? row.items :
                 Array.isArray(order.items)      ? order.items : [];
  return {
    id:          row.id,
    orderId:     row.order_id     ?? undefined,
    clientName:  client.name      ?? row.client_name ?? '—',
    clientPhone: client.phone     ?? undefined,
    items,
    amount:      Number(row.amount ?? 0),
    method:      (row.method      ?? 'wave') as MerchantPayMethod,
    status:      row.status       ?? 'pending',
    reference:   row.reference    ?? undefined,
    createdAt:   row.created_at,
  };
}

// ─── Requête principale ───────────────────────────────────────────────────────

export async function getMerchantPayments(prestataireId: string): Promise<MerchantPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, order:order_id(items), client:client_id(name, phone)')
    .eq('prestataire_id', prestataireId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPayment);
}

// ─── Calculs stats (client-side sur les données déjà chargées) ────────────────

export function computeStats(payments: MerchantPayment[]): PaymentStats {
  const success    = payments.filter(p => p.status === 'success');
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthOk    = success.filter(p => new Date(p.createdAt) >= monthStart);
  const waveCount  = success.filter(p => p.method === 'wave').length;
  const omCount    = success.filter(p => p.method === 'om').length;

  return {
    totalRevenue:     success.reduce((s, p) => s + p.amount, 0),
    transactionCount: success.length,
    monthRevenue:     monthOk.reduce((s, p) => s + p.amount, 0),
    topMethod:        waveCount >= omCount ? 'wave' : 'om',
  };
}

export function getLast7Days(payments: MerchantPayment[]): DayRevenue[] {
  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const result: DayRevenue[] = [];
  for (let i = 6; i >= 0; i--) {
    const d      = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().slice(0, 10);
    const amount  = payments
      .filter(p => p.status === 'success' && p.createdAt.slice(0, 10) === dateStr)
      .reduce((s, p) => s + p.amount, 0);
    result.push({ date: dateStr, label: DAYS_FR[d.getDay()], amount });
  }
  return result;
}
