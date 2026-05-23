import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Debtor } from '../types/debts';

// Données initiales — remplacées par les vraies données Supabase en Phase 3
const INITIAL_DEBTORS: Debtor[] = [
  { id: '1', initial: 'B', name: 'Babacar Fall',  status: 'late',  statusLabel: 'Retard critique', daysSince: 18, amount: 6500, phone: '221771234567' },
  { id: '2', initial: 'F', name: 'Fatou Diop',    status: 'watch', statusLabel: 'À surveiller',    daysSince: 6,  amount: 3000, phone: '221772345678' },
  { id: '3', initial: 'M', name: 'Mamadou Ba',    status: 'watch', statusLabel: 'À surveiller',    daysSince: 4,  amount: 2500, phone: '221773456789' },
  { id: '4', initial: 'A', name: 'Aïda Sarr',     status: 'good',  statusLabel: 'Bon payeur',      daysSince: 2,  amount: 1500, phone: '221774567890' },
  { id: '5', initial: 'O', name: 'Oumar Diallo',  status: 'good',  statusLabel: 'Bon payeur',      daysSince: 1,  amount: 750,  phone: '221775678901' },
  { id: '6', initial: 'K', name: 'Khady Ndiaye',  status: 'good',  statusLabel: 'Bon payeur',      daysSince: 3,  amount: 500,  phone: '221776789012' },
  { id: '7', initial: 'I', name: 'Ibrahima Sow',  status: 'good',  statusLabel: 'Bon payeur',      daysSince: 1,  amount: 250,  phone: '221777890123' },
];

interface DebtsState {
  debtors: Debtor[];

  // Ajouter un montant à un débiteur existant
  addToDebt:    (debtorId: string, amount: number) => void;
  // Ajouter un nouveau débiteur
  addDebtor:    (debtor: Omit<Debtor, 'id'>) => void;
  // Marquer payé → reset amount à 0, status good
  markPaid:     (debtorId: string) => void;
  // Supprimer un débiteur
  removeDebtor: (debtorId: string) => void;
}

const useDebtsStore = create<DebtsState>()(
  persist(
    (set) => ({
      debtors: INITIAL_DEBTORS,

      addToDebt: (debtorId, amount) => set((state) => ({
        debtors: state.debtors.map(d =>
          d.id === debtorId
            ? { ...d, amount: d.amount + amount, daysSince: 0 }
            : d
        ),
      })),

      addDebtor: (debtor) => set((state) => ({
        debtors: [
          ...state.debtors,
          { ...debtor, id: `d_${Date.now()}` },
        ],
      })),

      markPaid: (debtorId) => set((state) => ({
        debtors: state.debtors.map(d =>
          d.id === debtorId
            ? { ...d, amount: 0, status: 'good', statusLabel: 'Bon payeur', daysSince: 0 }
            : d
        ),
      })),

      removeDebtor: (debtorId) => set((state) => ({
        debtors: state.debtors.filter(d => d.id !== debtorId),
      })),
    }),
    {
      name:    'lassi-debts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useDebtsStore;
