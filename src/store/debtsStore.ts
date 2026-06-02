import { create }              from 'zustand';
import { Debtor }             from '../types/debts';
import * as debtsService      from '../services/debts';

interface DebtsState {
  debtors: Debtor[];
  shopId:  string | null;
  loading: boolean;

  // Chargement depuis Supabase (appelé par DebtsScreen au mount)
  loadDebts: (shopId: string) => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  addToDebt:    (debtorId: string, amount: number) => void;
  addDebtor:    (debtor: Omit<Debtor, 'id'>)       => Promise<void>;
  markPaid:     (debtorId: string)                 => void;
  removeDebtor: (debtorId: string)                 => void;

  setLoading: (v: boolean) => void;
}

const useDebtsStore = create<DebtsState>()((set, get) => ({
  debtors: [],
  shopId:  null,
  loading: false,

  setLoading: (v) => set({ loading: v }),

  loadDebts: async (shopId) => {
    set({ loading: true, shopId });
    try {
      const debtors = await debtsService.getDebts(shopId);
      set({ debtors, loading: false });
    } catch (err) {
      console.warn('[debtsStore] loadDebts:', err);
      set({ loading: false });
    }
  },

  addToDebt: (debtorId, amount) => {
    // Mise à jour optimiste
    set(state => ({
      debtors: state.debtors.map(d =>
        d.id === debtorId
          ? { ...d, amount: d.amount + amount, daysSince: 0 }
          : d,
      ),
    }));
    debtsService.addToDebt(debtorId, amount).catch(console.warn);
  },

  addDebtor: async (debtor) => {
    const { shopId } = get();
    if (!shopId) return;
    try {
      const saved = await debtsService.addDebtor(shopId, debtor.name, debtor.phone);
      set(state => ({ debtors: [...state.debtors, saved] }));
    } catch (err) {
      console.warn('[debtsStore] addDebtor:', err);
    }
  },

  markPaid: (debtorId) => {
    set(state => ({
      debtors: state.debtors.map(d =>
        d.id === debtorId
          ? { ...d, amount: 0, status: 'good', statusLabel: 'Bon payeur', daysSince: 0 }
          : d,
      ),
    }));
    debtsService.markPaid(debtorId).catch(console.warn);
  },

  removeDebtor: (debtorId) => {
    set(state => ({ debtors: state.debtors.filter(d => d.id !== debtorId) }));
    debtsService.removeDebtor(debtorId).catch(console.warn);
  },
}));

export default useDebtsStore;
