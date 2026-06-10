// Types partagés pour le module Paiement
import { OrderLineItem } from './orders';

/** Alias de OrderLineItem — conservé pour rétrocompatibilité avec les écrans de paiement. */
export type OrderItem = OrderLineItem;

export interface OrderInfo {
  ticketId: string; // ID du message ticket dans le chat (pour le retour)
  orderId: string; // ex : "#A427"
  shopInitial: string;
  shopName: string;
  shopLocation: string; // ex : "📍 Medina"
  items: OrderItem[];
  total: number;
  /** Frais de service LASSİ (1%) déjà inclus dans `total`. */
  commission?: number;
  orderType?: 'place' | 'emporter';
}

export type PayMethod = 'wave' | 'om';
