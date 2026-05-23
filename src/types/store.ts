// Types du module Ma Vitrine (prestataire)

export type StockStatus = 'in' | 'out';

export interface StoreCategory {
  id:    string;
  label: string;
  emoji: string;
}

export interface StoreProduct {
  id:       string;
  emoji:    string;
  name:     string;
  desc:     string;
  price:    number;
  category: string;   // id de StoreCategory
  stock:    StockStatus;
}

export interface StoreProfile {
  initial:  string;
  name:     string;
  subtitle: string;
  isOpen:   boolean;
}
