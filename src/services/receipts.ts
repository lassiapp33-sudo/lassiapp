import { supabase } from '../lib/supabase';

export type ReceiptStatus = 'aucun' | 'valide' | 'utilise' | 'expire';

export interface ReceiptInfo {
  orderId:           string;
  shopName:          string;
  receiptCode:       string;
  receiptStatus:     ReceiptStatus;
  validatedAt:       string;
  receiptValidUntil: string;
  items:             Array<{ name: string; qty: number; price: number }>;
  total:             number;
  createdAt:         string;
}

export interface VerifyResult {
  success:     boolean;
  reason?:     'introuvable' | 'expire' | 'deja_utilise' | 'aucun' | string;
  clientName?: string;
  total?:      number;
}

/** Charge le reçu d'une commande (côté client). */
export async function getReceipt(orderId: string): Promise<ReceiptInfo | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, receipt_code, receipt_status, validated_at, receipt_valid_until, total, created_at, order_items(*), shops(name)'
    )
    .eq('id', orderId)
    .single();

  if (error || !data || !data.receipt_code) return null;

  return {
    orderId:           data.id,
    shopName:          (data.shops as any)?.name ?? '—',
    receiptCode:       data.receipt_code,
    receiptStatus:     data.receipt_status as ReceiptStatus,
    validatedAt:       data.validated_at,
    receiptValidUntil: data.receipt_valid_until,
    items:             ((data.order_items as any[]) ?? []).map(i => ({
      name:  i.product_name ?? i.name ?? '—',
      qty:   i.qty   ?? 1,
      price: (i.unit_price ?? 0) * (i.qty ?? 1),
    })),
    total:     Number(data.total ?? 0),
    createdAt: data.created_at,
  };
}

/** Vérifie et utilise un reçu (côté prestataire, atomique). */
export async function verifyReceiptMerchant(code: string): Promise<VerifyResult> {
  const { data, error } = await supabase.rpc('verify_receipt', {
    p_code: code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  });
  if (error) throw new Error(error.message);
  return data as VerifyResult;
}
