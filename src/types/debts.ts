// Types du Cahier de Dettes

export type DebtStatus = 'late' | 'watch' | 'good';

export interface Debtor {
  id:          string;
  initial:     string;
  name:        string;
  status:      DebtStatus;
  statusLabel: string;   // ex : "Retard critique"
  daysSince:   number;   // ancienneté en jours
  amount:      number;   // montant dû en FCFA
  phone?:      string;   // numéro pour relance WhatsApp
}

export type DebtFilter = 'all' | 'late' | 'watch' | 'good';
