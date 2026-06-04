import { create } from 'zustand';

// Action de navigation en attente, émise quand l'utilisateur tape sur une
// notification push alors que l'app est fermée ou en arrière-plan.
// Les navigateurs (Home / Merchant) consomment cette valeur au montage ou
// dès qu'elle change, puis la vident.
export type PendingNav =
  | { type: 'msg'; conversationId: string }
  | { type: 'order'; orderId: string }
  | { type: 'home' };

interface PendingNavState {
  pendingNav: PendingNav | null;
  setPendingNav: (nav: PendingNav) => void;
  clearPendingNav: () => void;
}

const usePendingNavStore = create<PendingNavState>()(set => ({
  pendingNav: null,
  setPendingNav: nav => set({ pendingNav: nav }),
  clearPendingNav: () => set({ pendingNav: null }),
}));

export default usePendingNavStore;
