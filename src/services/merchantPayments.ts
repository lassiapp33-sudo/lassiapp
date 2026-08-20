import { supabase } from '../lib/supabase';
import {
  MerchantPayment,
  MerchantPayMethod,
  PaymentStats,
  DayRevenue,
} from '../types/merchantPayments';

// ─── Mapping méthode ──────────────────────────────────────────────────────────

function mapMethod(moyen: string | null): MerchantPayMethod {
  if (moyen === 'wave') return 'wave';
  return 'om'; // orange_money ou tout autre → om
}

// ─── Requête principale via RPC payout_queue (montant NET) ────────────────────

export async function getMerchantPayments(_prestataireId: string): Promise<MerchantPayment[]> {
  const { data, error } = await supabase.rpc('get_merchant_encaissements');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, any>) => ({
    id:          row.id,
    orderId:     row.order_id ?? undefined,
    clientName:  row.client_name ?? '—',
    clientPhone: undefined,
    items:       row.type_op === 'fitness' ? [{ name: 'Abonnement fitness', qty: 1, price: row.montant }] : [],
    amount:      Number(row.montant ?? 0),
    method:      mapMethod(row.moyen_paiement),
    status:      row.statut ?? 'pending',
    reference:   row.external_ref ?? undefined,
    createdAt:   row.date_op,
  }));
}

// ─── Calculs stats (client-side sur les données déjà chargées) ────────────────

export function computeStats(payments: MerchantPayment[]): PaymentStats {
  const success = payments.filter(p => p.status === 'success');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthOk = success.filter(p => new Date(p.createdAt) >= monthStart);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  const last7 = success.filter(p => new Date(p.createdAt) >= cutoff);
  const waveAmount = last7.filter(p => p.method === 'wave').reduce((s, p) => s + p.amount, 0);
  const omAmount   = last7.filter(p => p.method === 'om').reduce((s, p) => s + p.amount, 0);
  const topMethod: MerchantPayMethod | null =
    last7.length === 0 ? null : waveAmount >= omAmount ? 'wave' : 'om';

  return {
    totalRevenue:     success.reduce((s, p) => s + p.amount, 0),
    transactionCount: success.length,
    monthRevenue:     monthOk.reduce((s, p) => s + p.amount, 0),
    topMethod,
  };
}

export function getLast7Days(payments: MerchantPayment[]): DayRevenue[] {
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
