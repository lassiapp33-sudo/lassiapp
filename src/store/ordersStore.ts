import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IncomingOrder, OrderStatus } from '../types/orders';

// Données initiales — remplacées par le flux temps-réel Supabase en Phase 3
const INITIAL_ORDERS: IncomingOrder[] = [
  {
    id: 'o1', orderId: '#A427', initial: 'A', clientName: 'Aïssatou Ndiaye',
    status: 'new', payMethod: 'wave', total: 1200, timeLabel: 'il y a 2 min',
    items: [
      { qty: 2, name: 'Pain Œuf Mayo', price: 1000 },
      { qty: 1, name: 'Café Touba',    price: 200  },
    ],
  },
  {
    id: 'o2', orderId: '#A428', initial: 'O', clientName: 'Omar Diène',
    status: 'new', payMethod: 'om', total: 1050, timeLabel: 'il y a 5 min',
    items: [
      { qty: 1, name: 'Pain Viande', price: 800 },
      { qty: 1, name: 'Thé Lipton',  price: 250 },
    ],
  },
  {
    id: 'o3', orderId: '#A425', initial: 'M', clientName: 'Moussa Sow',
    status: 'preparing', payMethod: 'wave', total: 800,
    timeLabel: 'acceptée à 08:09', prepTime: '10-15 min',
    items: [
      { qty: 1, name: 'Spaghetti',  price: 600 },
      { qty: 1, name: 'Café Touba', price: 200 },
    ],
  },
];

interface OrdersState {
  orders: IncomingOrder[];

  setOrderStatus: (id: string, status: OrderStatus, prepTime?: string) => void;
  removeOrder:    (id: string) => void;
  addOrder:       (order: IncomingOrder) => void;
}

const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: INITIAL_ORDERS,

      setOrderStatus: (id, status, prepTime) => set((state) => ({
        orders: state.orders.map(o =>
          o.id === id
            ? { ...o, status, ...(prepTime ? { prepTime } : {}) }
            : o
        ),
      })),

      removeOrder: (id) => set((state) => ({
        orders: state.orders.filter(o => o.id !== id),
      })),

      addOrder: (order) => set((state) => ({
        orders: [...state.orders, order],
      })),
    }),
    {
      name:    'lassi-orders',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useOrdersStore;
