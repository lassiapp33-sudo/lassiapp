// Types du module Commandes reçues (côté prestataire)

export type OrderStatus   = 'new' | 'preparing' | 'ready' | 'done' | 'refused';
export type PayMethodOrder = 'wave' | 'om';

// Onglets de filtrage côté prestataire
// 'preparing' couvre les statuts DB 'preparing' + 'ready' (commande acceptée, en cours)
export type MerchantTab = 'all' | 'new' | 'preparing' | 'done' | 'refused';

export interface IncomingOrderItem {
  qty:   number;
  name:  string;
  price: number;   // total de la ligne (qty × prix unitaire)
}

export interface IncomingOrder {
  id:             string;
  orderId:        string;        // ex : "#A427"
  initial:        string;
  clientName:     string;
  avatarUrl?:     string | null; // photo de profil du client (profiles.avatar_url)
  status:         OrderStatus;
  items:          IncomingOrderItem[];
  total:          number;
  payMethod:      PayMethodOrder;
  timeLabel:      string;        // "il y a 2 min" / "acceptée à 08:09"
  prepTime?:      string;        // "5-10 min" — défini à l'acceptation
  orderType:      'place' | 'emporter';
  refusalReason?: string | null;
}
