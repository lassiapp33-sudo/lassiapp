import { OrderLineItem } from './orders';

export type PaymentStatus    = 'pending' | 'success' | 'failed' | 'refunded';

// Interface locale pour les relations nested Supabase dans rowToPayment
export interface PaymentClientRow  { name?: string | null; phone?: string | null; }
export interface PaymentOrderRow   { items?: OrderLineItem[] | null; }
export type MerchantPayMethod = 'wave' | 'om';
export type PaymentFilter     = 'all' | 'wave' | 'om';

/** Alias de OrderLineItem — conservé pour rétrocompatibilité avec les écrans paiements. */
export type MerchantPaymentItem = OrderLineItem;

export interface MerchantPayment {
  id:           string;
  orderId?:     string;
  clientName:   string;
  clientPhone?: string;
  items:        MerchantPaymentItem[];
  amount:       number;
  method:       MerchantPayMethod;
  status:       PaymentStatus;
  reference?:   string;
  createdAt:    string;
}

export interface PaymentStats {
  totalRevenue:     number;
  transactionCount: number;
  monthRevenue:     number;
  topMethod:        MerchantPayMethod;
}

export interface DayRevenue {
  date:   string;  // YYYY-MM-DD
  label:  string;  // "Lun", "Mar"…
  amount: number;
}
