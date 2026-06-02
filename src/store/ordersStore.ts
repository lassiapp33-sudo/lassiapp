import { create }                      from 'zustand';
import { IncomingOrder, OrderStatus }  from '../types/orders';
import * as ordersService              from '../services/orders';

interface OrdersState {
  orders:   IncomingOrder[];
  shopId:   string | null;
  loading:  boolean;

  // Chargement depuis Supabase (appelé par OrdersScreen au mount)
  loadOrders: (shopId: string) => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  setOrderStatus: (id: string, status: OrderStatus, prepTime?: string) => void;
  removeOrder:    (id: string) => void;
  addOrder:       (order: IncomingOrder) => void;

  setLoading: (v: boolean) => void;
}

const useOrdersStore = create<OrdersState>()((set) => ({
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

  // Refuse la commande — la garde dans la liste (visible dans l'onglet Annulées)
  removeOrder: (id) => {
    set(state => ({
      orders: state.orders.map(o =>
        o.id === id ? { ...o, status: 'refused' as const } : o
      ),
    }));
    ordersService.updateOrderStatus(id, 'refused').catch(console.warn);
  },

  addOrder: (order) => set(state => ({ orders: [order, ...state.orders] })),
}));

export default useOrdersStore;
