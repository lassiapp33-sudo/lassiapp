import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string;
  name: string;
  emoji: string;
  price: number; // prix unitaire
  qty: number;
}

export type OrderType = 'place' | 'emporter';

export interface CartShopInfo {
  id: string;
  initial: string;
  name: string;
  location: string;
  logoUrl?: string;
}

interface CartState {
  shopInfo: CartShopInfo | null;
  items: CartItem[];
  orderType: OrderType;

  addItem: (shopInfo: CartShopInfo, item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
}

const useCartStore = create<CartState>()(
  persist(
    set => ({
      shopInfo: null,
      items: [],
      orderType: 'place' as OrderType,

      setOrderType: type => set({ orderType: type }),

      addItem: (shopInfo, item) =>
        set(state => {
          const existing = state.items.find(i => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map(i => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)),
            };
          }
          return {
            shopInfo,
            items: [...state.items, { ...item, qty: 1 }],
          };
        }),

      removeItem: id =>
        set(state => {
          const item = state.items.find(i => i.id === id);
          if (!item) return state;
          if (item.qty <= 1) {
            const items = state.items.filter(i => i.id !== id);
            return { items, shopInfo: items.length === 0 ? null : state.shopInfo };
          }
          return { items: state.items.map(i => (i.id === id ? { ...i, qty: i.qty - 1 } : i)) };
        }),

      updateQty: (id, qty) =>
        set(state => {
          if (qty <= 0) {
            const items = state.items.filter(i => i.id !== id);
            return { items, shopInfo: items.length === 0 ? null : state.shopInfo };
          }
          return { items: state.items.map(i => (i.id === id ? { ...i, qty } : i)) };
        }),

      clearCart: () => set({ items: [], shopInfo: null, orderType: 'place' }),
    }),
    {
      name: 'lassi-cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useCartStore;
