import { create } from 'zustand';
import { Debtor } from '../types/debts';
import * as debtsService from '../services/debts';
import logger from '../utils/logger';
import { isNetworkError } from '../utils/network';
import { getCachedJSON, setCachedJSON } from '../lib/secureCache';
import useConnectionStore from './connectionStore';

// Section 10 — cache local chiffré du cahier de dettes : permet de consulter
// la dernière version connue en mode dégradé (Supabase injoignable).
const cacheKey = (shopId: string) => `debts_${shopId}`;

function persistCache(shopId: string | null, debtors: Debtor[]) {
  if (shopId) setCachedJSON(cacheKey(shopId), debtors);
}

interface DebtsState {
  debtors: Debtor[];
  shopId: string | null;
  loading: boolean;
  // true si les données affichées proviennent du cache hors-ligne
  fromCache: boolean;

  // Chargement depuis Supabase (appelé par DebtsScreen au mount)
  loadDebts: (shopId: string) => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  addToDebt: (debtorId: string, amount: number) => Promise<void>;
  addDebtor: (debtor: Omit<Debtor, 'id'>) => Promise<void>;
  markPaid: (debtorId: string) => Promise<void>;
  removeDebtor: (debtorId: string) => Promise<void>;

  setLoading: (v: boolean) => void;
  reset: () => void;
}

const useDebtsStore = create<DebtsState>()((set, get) => ({
  debtors: [],
  shopId: null,
  loading: false,
  fromCache: false,

  setLoading: v => set({ loading: v }),

  reset: () => set({ debtors: [], shopId: null, loading: false, fromCache: false }),

  loadDebts: async shopId => {
    set({ loading: true, shopId });
    try {
      const debtors = await debtsService.getDebts(shopId);
      set({ debtors, loading: false, fromCache: false });
      useConnectionStore.getState().setOffline(false);
      persistCache(shopId, debtors);
    } catch (err) {
      logger.warn('[debtsStore] loadDebts:', err);
      if (isNetworkError(err)) {
        useConnectionStore.getState().setOffline(true);
        const cached = await getCachedJSON<Debtor[]>(cacheKey(shopId));
        if (cached) {
          set({ debtors: cached, loading: false, fromCache: true });
          return;
        }
      }
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
      persistCache(get().shopId, get().debtors);
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
    persistCache(shopId, get().debtors);
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
      persistCache(get().shopId, get().debtors);
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
      persistCache(get().shopId, get().debtors);
    } catch (err) {
      set({ debtors: prev });
      throw err;
    }
  },
}));

export default useDebtsStore;
