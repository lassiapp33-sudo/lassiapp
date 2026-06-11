import { create } from 'zustand';

interface ConnectionState {
  // Section 10 — Mode dégradé : true tant que Supabase est injoignable.
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
}

const useConnectionStore = create<ConnectionState>()((set, get) => ({
  isOffline: false,

  setOffline: offline => {
    if (get().isOffline !== offline) set({ isOffline: offline });
  },
}));

export default useConnectionStore;
