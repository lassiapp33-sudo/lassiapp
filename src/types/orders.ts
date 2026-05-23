// Types du module Commandes reçues (côté prestataire)

export type OrderStatus   = 'new' | 'preparing' | 'ready' | 'done';
export type PayMethodOrder = 'wave' | 'om';

export interface IncomingOrderItem {
  qty:   number;
  name:  string;
  price: number;   // total de la ligne (qty × prix unitaire)
}

export interface IncomingOrder {
  id:         string;
  orderId:    string;        // ex : "#A427"
  initial:    string;
  clientName: string;
  status:     OrderStatus;
  items:      IncomingOrderItem[];
  total:      number;
  payMethod:  PayMethodOrder;
  timeLabel:  string;        // "il y a 2 min" / "acceptée à 08:09"
  prepTime?:  string;        // "5-10 min" — défini à l'acceptation
}
