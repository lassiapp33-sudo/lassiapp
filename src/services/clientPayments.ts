import { supabase } from '../lib/supabase';
import { MerchantPayMethod, PaymentStatus, DayRevenue, PaymentStats } from '../types/merchantPayments';

export interface ClientPayment {
  id: string;
  orderId?: string;
  prestataireName: string;
  items: Array<{ name: string; qty?: number; price?: number }>;
  amount: number;
  method: MerchantPayMethod;
  status: PaymentStatus;
  reference?: string;
  createdAt: string;
}

function rowToClientPayment(
  row: Record<string, any>,
  shopNameMap: Record<string, string>,
): ClientPayment {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    orderId: row.order_id ?? undefined,
    prestataireName: shopNameMap[row.prestataire_id] ?? '—',
    items,
    amount: Number(row.amount ?? 0),
    method: (row.method ?? 'wave') as MerchantPayMethod,
    status: row.status ?? 'pending',
    reference: row.reference ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getClientPayments(clientId: string): Promise<ClientPayment[]> {
  // payments.prestataire_id → auth.users (not public schema) — PostgREST can't auto-join.
  // We batch-fetch shop names separately via shops.merchant_id.
  const { data, error } = await supabase
    .from('payments')
    .select('id, order_id, prestataire_id, amount, method, status, reference, items, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const prestataireIds = [...new Set(rows.map(r => r.prestataire_id).filter(Boolean))];

  let shopNameMap: Record<string, string> = {};
  if (prestataireIds.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('merchant_id, name')
      .in('merchant_id', prestataireIds);
    shopNameMap = Object.fromEntries((shops ?? []).map(s => [s.merchant_id, s.name]));
  }

  return rows.map(r => rowToClientPayment(r, shopNameMap));
}

export function computeClientStats(payments: ClientPayment[]): PaymentStats {
  const success = payments.filter(p => p.status === 'success');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthOk = success.filter(p => new Date(p.createdAt) >= monthStart);
  const waveCount = success.filter(p => p.method === 'wave').length;
  const omCount = success.filter(p => p.method === 'om').length;
  return {
    totalRevenue: success.reduce((s, p) => s + p.amount, 0),
    transactionCount: success.length,
    monthRevenue: monthOk.reduce((s, p) => s + p.amount, 0),
    topMethod: waveCount >= omCount ? 'wave' : 'om',
  };
}

export function getLast7Days(payments: ClientPayment[]): DayRevenue[] {
  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const result: DayRevenue[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().slice(0, 10);
    const amount = payments
      .filter(p => p.status === 'success' && p.createdAt.slice(0, 10) === dateStr)
      .reduce((s, p) => s + p.amount, 0);
    result.push({ date: dateStr, label: DAYS_FR[d.getDay()], amount });
  }
  return result;
}
