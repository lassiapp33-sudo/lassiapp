import { create }                      from 'zustand';
import { IncomingOrder, OrderStatus }  from '../types/orders';
import * as ordersService              from '../services/orders';

interface OrdersState {
  orders:   IncomingOrder[];
  shopId:   string | null;
  loading:  boolean;

  loadOrders:    (shopId: string) => Promise<void>;
  setOrderStatus:(id: string, status: OrderStatus, prepTime?: string) => void;
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
      console.warn('[ordersStore] loadOrders:', err);
      set({ loading: false });
    }
  },

  setOrderStatus: (id, status, prepTime) => {
    set(state => ({
      orders: state.orders.map(o =>
        o.id === id
          ? { ...o, status, ...(prepTime ? { prepTime } : {}) }
          : o,
      ),
    }));
    ordersService.updateOrderStatus(id, status, prepTime).catch(console.warn);
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
