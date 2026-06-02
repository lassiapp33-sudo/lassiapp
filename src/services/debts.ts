import { supabase }            from '../lib/supabase';
import { Debtor, DebtStatus }  from '../types/debts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStatus(amount: number, daysSince: number): DebtStatus {
  if (amount <= 0)     return 'good';
  if (daysSince >= 7)  return 'late';
  if (daysSince >= 3)  return 'watch';
  return 'good';
}

function statusLabel(status: DebtStatus): string {
  if (status === 'late')  return 'En retard';
  if (status === 'watch') return 'À surveiller';
  return 'Bon payeur';
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function rowToDebtor(row: Record<string, any>): Debtor {
  const daysSince = Math.floor(
    (Date.now() - new Date(row.last_updated).getTime()) / 86400000,
  );
  const status = computeStatus(row.amount, daysSince);
  return {
    id:          row.id,
    initial:     (row.client_name ?? 'C').charAt(0).toUpperCase(),
    name:        row.client_name,
    status,
    statusLabel: statusLabel(status),
    daysSince,
    amount:      row.amount,
    phone:       row.client_phone ?? undefined,
  };
}

// ─── Requêtes ────────────────────────────────────────────────────────────────

export async function getDebts(shopId: string): Promise<Debtor[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToDebtor);
}

export async function addDebtor(
  shopId: string,
  name:   string,
  phone?: string,
): Promise<Debtor> {
  const { data, error } = await supabase
    .from('debts')
    .insert({
      shop_id:      shopId,
      client_name:  name,
      client_phone: phone ?? null,
      amount:       0,
      status:       'good',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDebtor(data);
}

export async function addToDebt(debtId: string, amount: number): Promise<void> {
  const { data: current, error: fetchErr } = await supabase
    .from('debts')
    .select('amount')
    .eq('id', debtId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const newAmount = (current.amount ?? 0) + amount;
  const daysSince = 0;
  const status    = computeStatus(newAmount, daysSince);

  const { error: updateErr } = await supabase
    .from('debts')
    .update({ amount: newAmount, status, last_updated: new Date().toISOString() })
    .eq('id', debtId);
  if (updateErr) throw new Error(updateErr.message);

  // Log the transaction
  await supabase.from('debt_transactions').insert({ debt_id: debtId, amount });
}

export async function markPaid(debtId: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ amount: 0, status: 'good', last_updated: new Date().toISOString() })
    .eq('id', debtId);
  if (error) throw new Error(error.message);
  await supabase.from('debt_transactions').insert({ debt_id: debtId, amount: 0, note: 'Paiement complet' });
}

export async function removeDebtor(debtId: string): Promise<void> {
  const { error } = await supabase.from('debts').delete().eq('id', debtId);
  if (error) throw new Error(error.message);
}
