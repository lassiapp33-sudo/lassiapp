// Types partagés pour le module Paiement

export interface OrderItem {
  qty:   number;
  name:  string;
  price: number;
}

export interface OrderInfo {
  ticketId:     string;   // ID du message ticket dans le chat (pour le retour)
  orderId:      string;   // ex : "#A427"
  shopInitial:  string;
  shopName:     string;
  shopLocation: string;   // ex : "📍 Medina"
  items:        OrderItem[];
  total:        number;
  orderType:    'place' | 'emporter';
}

export type PayMethod = 'wave' | 'om';
