export type PaymentStatus    = 'pending' | 'success' | 'failed' | 'refunded';
export type MerchantPayMethod = 'wave' | 'om';
export type PaymentFilter     = 'all' | 'wave' | 'om';

export interface MerchantPaymentItem {
  name:   string;
  qty?:   number;
  price?: number;
}

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
