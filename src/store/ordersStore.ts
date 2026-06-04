import { create }                      from 'zustand';
import { IncomingOrder, OrderStatus }  from '../types/orders';
import * as ordersService              from '../services/orders';
import logger                         from '../utils/logger';

interface OrdersState {
  orders:   IncomingOrder[];
  shopId:   string | null;
  loading:  boolean;

  loadOrders:    (shopId: string) => Promise<void>;
  // Action utilisateur (optimiste + DB + rollback)
  setOrderStatus:(id: string, status: OrderStatus, prepTime?: string) => Promise<void>;
  // Sync realtime : état déjà confirmé côté serveur, pas d'appel DB
  syncOrderStatus:(id: string, status: OrderStatus, prepTime?: string) => void;
  refuseOrder:   (id: string, reason?: string) => Promise<void>;
  addOrder:      (order: IncomingOrder) => void;
  setLoading:    (v: boolean) => void;
}

const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders:  [],
  shopId:  null,
  loading: false,

  setLoading: (v) => set({ loading: v }),

  loadOrders: async (shopId) => {
    set({ loading: true, shopId });
    try {
      const orders = await ordersService.getShopOrders(shopId);
      set({ orders, loading: false });
    } catch (err) {
      logger.warn('[ordersStore] loadOrders:', err);
      set({ loading: false });
    }
  },

  setOrderStatus: async (id, status, prepTime) => {
    const prev = get().orders;
    set(state => ({
      orders: state.orders.map(o =>
        o.id === id
          ? { ...o, status, ...(prepTime ? { prepTime } : {}) }
          : o,
      ),
    }));
    try {
      await ordersService.updateOrderStatus(id, status, prepTime);
    } catch (err) {
      set({ orders: prev });
      throw err;
    }
  },

  syncOrderStatus: (id, status, prepTime) => {
    set(state => ({
      orders: state.orders.map(o =>
        o.id === id
          ? { ...o, status, ...(prepTime ? { prepTime } : {}) }
          : o,
      ),
    }));
  },

  refuseOrder: async (id, reason) => {
    const prev = get().orders;
    // Mise à jour optimiste
    set(state => ({
      orders: state.orders.map(o =>
        o.id === id
          ? { ...o, status: 'refused' as const, refusalReason: reason ?? null }
          : o,
      ),
    }));
    try {
      await ordersService.refuseOrder(id, reason);
    } catch (err) {
      // Rollback si le serveur rejette
      set({ orders: prev });
      throw err;
    }
  },

  addOrder: (order) => set(state => ({ orders: [order, ...state.orders] })),
}));

export default useOrdersStore;
