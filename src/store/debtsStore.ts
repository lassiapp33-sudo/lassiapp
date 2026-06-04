import { create } from 'zustand';
import { Debtor } from '../types/debts';
import * as debtsService from '../services/debts';
import logger from '../utils/logger';

interface DebtsState {
  debtors: Debtor[];
  shopId: string | null;
  loading: boolean;

  // Chargement depuis Supabase (appelé par DebtsScreen au mount)
  loadDebts: (shopId: string) => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  addToDebt: (debtorId: string, amount: number) => Promise<void>;
  addDebtor: (debtor: Omit<Debtor, 'id'>) => Promise<void>;
  markPaid: (debtorId: string) => Promise<void>;
  removeDebtor: (debtorId: string) => Promise<void>;

  setLoading: (v: boolean) => void;
}

const useDebtsStore = create<DebtsState>()((set, get) => ({
  debtors: [],
  shopId: null,
  loading: false,

  setLoading: v => set({ loading: v }),

  loadDebts: async shopId => {
    set({ loading: true, shopId });
    try {
      const debtors = await debtsService.getDebts(shopId);
      set({ debtors, loading: false });
    } catch (err) {
      logger.warn('[debtsStore] loadDebts:', err);
      set({ loading: false });
    }
  },

  addToDebt: async (debtorId, amount) => {
    const prev = get().debtors;
    set(state => ({
      debtors: state.debtors.map(d =>
        d.id === debtorId ? { ...d, amount: d.amount + amount, daysSince: 0 } : d,
      ),
    }));
    try {
      await debtsService.addToDebt(debtorId, amount);
    } catch (err) {
      set({ debtors: prev });
      throw err;
    }
  },

  addDebtor: async debtor => {
    const { shopId } = get();
    if (!shopId) return;
    const saved = await debtsService.addDebtor(shopId, debtor.name, debtor.phone);
    set(state => ({ debtors: [...state.debtors, saved] }));
  },

  markPaid: async debtorId => {
    const prev = get().debtors;
    set(state => ({
      debtors: state.debtors.map(d =>
        d.id === debtorId
          ? { ...d, amount: 0, status: 'good', statusLabel: 'Bon payeur', daysSince: 0 }
          : d,
      ),
    }));
    try {
      await debtsService.markPaid(debtorId);
    } catch (err) {
      set({ debtors: prev });
      throw err;
    }
  },

  removeDebtor: async debtorId => {
    const prev = get().debtors;
    set(state => ({ debtors: state.debtors.filter(d => d.id !== debtorId) }));
    try {
      await debtsService.removeDebtor(debtorId);
    } catch (err) {
      set({ debtors: prev });
      throw err;
    }
  },
}));

export default useDebtsStore;
