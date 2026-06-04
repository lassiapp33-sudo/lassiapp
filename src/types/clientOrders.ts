// Statuts DB réels : 'new' | 'preparing' | 'ready' | 'done' | 'refused'
// Mappés côté client  : 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled'
import { OrderLineItem } from './orders';

export type ClientOrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
export type CommerceType      = 'food' | 'beauty' | 'service' | 'other';
export type PaymentMethod     = 'wave' | 'orange_money';
export type OrderFilter       = 'all' | 'active' | 'completed' | 'cancelled';

/** Alias de OrderLineItem — conservé pour rétrocompatibilité avec les écrans client. */
export type OrderItem = OrderLineItem;

export type ReceiptStatus = 'aucun' | 'valide' | 'utilise' | 'expire';

export interface ClientOrder {
  id:                  string;
  shopId:              string;
  commerceName:        string;
  commerceType:        CommerceType;
  items:               OrderItem[];
  totalAmount:         number;
  paymentMethod:       PaymentMethod;
  status:              ClientOrderStatus;
  notes?:              string;
  createdAt:           string;
  avisId?:             string;
  // Reçu
  receiptCode?:        string;
  receiptStatus?:      ReceiptStatus;
  receiptValidUntil?:  string;
  validatedAt?:        string;
}
