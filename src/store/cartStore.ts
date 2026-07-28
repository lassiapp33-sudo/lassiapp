import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
}

export type OrderType = 'place' | 'emporter';

export interface CartShopInfo {
  id: string;
  initial: string;
  name: string;
  location: string;
  logoUrl?: string;
  showOrderType?: boolean;
}

export interface SubBasket {
  id: string;
  label: string;
  items: CartItem[];
}

const uid = () => Math.random().toString(36).slice(2, 9);
const newBasket = (label = 'Mon panier'): SubBasket => ({ id: uid(), label, items: [] });

interface CartState {
  shopInfo: CartShopInfo | null;
  baskets: SubBasket[];
  activeBasketId: string;
  orderType: OrderType;

  addBasket: (label: string) => void;
  removeBasket: (id: string) => void;
  setActiveBasket: (id: string) => void;
  renameBasket: (id: string, label: string) => void;
  removeFromAllBaskets: (ids: string[]) => void;
  addItem: (shopInfo: CartShopInfo, item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
}

// ── Selectors ──────────────────────────────────────────────────────────────
export const selectActiveItems = (s: CartState): CartItem[] =>
  (s.baskets ?? []).find(b => b.id === s.activeBasketId)?.items ?? [];

export const selectTotalQty = (s: CartState): number =>
  (s.baskets ?? []).reduce((sum, b) => sum + b.items.reduce((n, i) => n + i.qty, 0), 0);

export const selectTotalPrice = (s: CartState): number =>
  (s.baskets ?? []).reduce((sum, b) => sum + b.items.reduce((n, i) => n + i.price * i.qty, 0), 0);
// ───────────────────────────────────────────────────────────────────────────

const useCartStore = create<CartState>()(
  persist(
    set => {
      const init = newBasket();
      return {
        shopInfo: null,
        baskets: [init],
        activeBasketId: init.id,
        orderType: 'place' as OrderType,

        setOrderType: type => set({ orderType: type }),

        addBasket: label => {
          const b = newBasket(label);
          set(s => ({ baskets: [...s.baskets, b], activeBasketId: b.id }));
        },

        removeBasket: id =>
          set(s => {
            const baskets = s.baskets.filter(b => b.id !== id);
            if (baskets.length === 0) {
              const fresh = newBasket();
              return { baskets: [fresh], activeBasketId: fresh.id, shopInfo: null };
            }
            const activeBasketId =
              s.activeBasketId === id ? baskets[baskets.length - 1].id : s.activeBasketId;
            const anyItems = baskets.some(b => b.items.length > 0);
            return { baskets, activeBasketId, shopInfo: anyItems ? s.shopInfo : null };
          }),

        setActiveBasket: id => set({ activeBasketId: id }),

        renameBasket: (id, label) =>
          set(s => ({ baskets: s.baskets.map(b => (b.id === id ? { ...b, label } : b)) })),

        removeFromAllBaskets: ids =>
          set(s => {
            const baskets = s.baskets.map(b => ({
              ...b,
              items: b.items.filter(i => !ids.includes(i.id)),
            }));
            const anyItems = baskets.some(b => b.items.length > 0);
            return { baskets, shopInfo: anyItems ? s.shopInfo : null };
          }),

        addItem: (shopInfo, item) =>
          set(s => {
            const baskets = s.baskets.map(b => {
              if (b.id !== s.activeBasketId) return b;
              const existing = b.items.find(i => i.id === item.id);
              return {
                ...b,
                items: existing
                  ? b.items.map(i => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
                  : [...b.items, { ...item, qty: 1 }],
              };
            });
            return { shopInfo, baskets };
          }),

        removeItem: id =>
          set(s => {
            const baskets = s.baskets.map(b => {
              if (b.id !== s.activeBasketId) return b;
              const item = b.items.find(i => i.id === id);
              if (!item) return b;
              return {
                ...b,
                items:
                  item.qty <= 1
                    ? b.items.filter(i => i.id !== id)
                    : b.items.map(i => (i.id === id ? { ...i, qty: i.qty - 1 } : i)),
              };
            });
            const anyItems = baskets.some(b => b.items.length > 0);
            return { baskets, shopInfo: anyItems ? s.shopInfo : null };
          }),

        updateQty: (id, qty) =>
          set(s => {
            const baskets = s.baskets.map(b => {
              if (b.id !== s.activeBasketId) return b;
              return {
                ...b,
                items:
                  qty <= 0
                    ? b.items.filter(i => i.id !== id)
                    : b.items.map(i => (i.id === id ? { ...i, qty } : i)),
              };
            });
            const anyItems = baskets.some(b => b.items.length > 0);
            return { baskets, shopInfo: anyItems ? s.shopInfo : null };
          }),

        clearCart: () => {
          const fresh = newBasket();
          set({ baskets: [fresh], activeBasketId: fresh.id, shopInfo: null, orderType: 'place' });
        },
      };
    },
    {
      name: 'lassi-cart',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const old = ((persisted ?? {}) as {
          items?: CartItem[];
          baskets?: SubBasket[];
          activeBasketId?: string;
          shopInfo?: CartShopInfo | null;
          orderType?: OrderType;
        });
        if (version < 2 || !Array.isArray(old.baskets)) {
          const b = newBasket();
          b.items = Array.isArray(old.items) ? old.items : [];
          return {
            shopInfo: old.shopInfo ?? null,
            baskets: [b],
            activeBasketId: b.id,
            orderType: old.orderType ?? 'place',
          };
        }
        return persisted as CartState;
      },
    },
  ),
);

export default useCartStore;
