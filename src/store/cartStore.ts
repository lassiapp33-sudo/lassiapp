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
  isVip?: boolean;
  paymentMethods?: ('wave' | 'om')[];
}

/** Un panier = un ensemble de sous-paniers par boutique (multi-prestataire). */
export interface CartShop {
  info: CartShopInfo;
  items: CartItem[];
}

interface CartState {
  shops: CartShop[];
  activeShopId: string | null;
  orderType: OrderType;

  addItem: (shopInfo: CartShopInfo, item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;                       // "-" sur la boutique active
  updateQty: (id: string, qty: number) => void;           // qty absolue, boutique active
  removeItemFromShop: (shopId: string, id: string) => void;
  updateQtyInShop: (shopId: string, id: string, qty: number) => void;
  removeShop: (shopId: string) => void;
  setActiveShop: (shopId: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
}

// ── Selectors ──────────────────────────────────────────────────────────────
export const selectShops = (s: CartState): CartShop[] => s.shops ?? [];

export const selectItemsForShop = (s: CartState, shopId: string): CartItem[] =>
  (s.shops ?? []).find(sh => sh.info.id === shopId)?.items ?? [];

/** Articles de la boutique active (rétro-compat : ShopScreen affiche la qty par produit). */
export const selectActiveItems = (s: CartState): CartItem[] =>
  (s.shops ?? []).find(sh => sh.info.id === s.activeShopId)?.items ?? [];

export const selectActiveShopInfo = (s: CartState): CartShopInfo | null =>
  (s.shops ?? []).find(sh => sh.info.id === s.activeShopId)?.info ?? null;

/** Quantité totale TOUS prestataires (badge flottant). */
export const selectTotalQty = (s: CartState): number =>
  (s.shops ?? []).reduce((sum, sh) => sum + sh.items.reduce((n, i) => n + i.qty, 0), 0);

/** Prix total TOUS prestataires (prix boutique, hors commission). */
export const selectTotalPrice = (s: CartState): number =>
  (s.shops ?? []).reduce((sum, sh) => sum + sh.items.reduce((n, i) => n + i.price * i.qty, 0), 0);
// ───────────────────────────────────────────────────────────────────────────

// Retire les boutiques vides et recale activeShopId si besoin.
function prune(shops: CartShop[], activeShopId: string | null): { shops: CartShop[]; activeShopId: string | null } {
  const next = shops.filter(sh => sh.items.length > 0);
  const active =
    activeShopId && next.some(sh => sh.info.id === activeShopId)
      ? activeShopId
      : next.length > 0
        ? next[next.length - 1].info.id
        : null;
  return { shops: next, activeShopId: active };
}

const useCartStore = create<CartState>()(
  persist(
    set => ({
      shops: [],
      activeShopId: null,
      orderType: 'place' as OrderType,

      setOrderType: type => set({ orderType: type }),

      setActiveShop: shopId => set({ activeShopId: shopId }),

      addItem: (shopInfo, item) =>
        set(s => {
          const shops = [...(s.shops ?? [])];
          const idx = shops.findIndex(sh => sh.info.id === shopInfo.id);
          if (idx === -1) {
            shops.push({ info: shopInfo, items: [{ ...item, qty: 1 }] });
          } else {
            const existing = shops[idx].items.find(i => i.id === item.id);
            shops[idx] = {
              info: shopInfo, // rafraîchir l'info boutique (nom/logo/paymentMethods)
              items: existing
                ? shops[idx].items.map(i => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
                : [...shops[idx].items, { ...item, qty: 1 }],
            };
          }
          return { shops, activeShopId: shopInfo.id };
        }),

      removeItem: id =>
        set(s => {
          const shops = (s.shops ?? []).map(sh => {
            if (sh.info.id !== s.activeShopId) return sh;
            const it = sh.items.find(i => i.id === id);
            if (!it) return sh;
            return {
              ...sh,
              items:
                it.qty <= 1
                  ? sh.items.filter(i => i.id !== id)
                  : sh.items.map(i => (i.id === id ? { ...i, qty: i.qty - 1 } : i)),
            };
          });
          return prune(shops, s.activeShopId);
        }),

      updateQty: (id, qty) =>
        set(s => {
          const shops = (s.shops ?? []).map(sh => {
            if (sh.info.id !== s.activeShopId) return sh;
            return {
              ...sh,
              items:
                qty <= 0
                  ? sh.items.filter(i => i.id !== id)
                  : sh.items.map(i => (i.id === id ? { ...i, qty } : i)),
            };
          });
          return prune(shops, s.activeShopId);
        }),

      removeItemFromShop: (shopId, id) =>
        set(s => {
          const shops = (s.shops ?? []).map(sh => {
            if (sh.info.id !== shopId) return sh;
            const it = sh.items.find(i => i.id === id);
            if (!it) return sh;
            return {
              ...sh,
              items:
                it.qty <= 1
                  ? sh.items.filter(i => i.id !== id)
                  : sh.items.map(i => (i.id === id ? { ...i, qty: i.qty - 1 } : i)),
            };
          });
          return prune(shops, s.activeShopId);
        }),

      updateQtyInShop: (shopId, id, qty) =>
        set(s => {
          const shops = (s.shops ?? []).map(sh => {
            if (sh.info.id !== shopId) return sh;
            return {
              ...sh,
              items:
                qty <= 0
                  ? sh.items.filter(i => i.id !== id)
                  : sh.items.map(i => (i.id === id ? { ...i, qty } : i)),
            };
          });
          return prune(shops, s.activeShopId);
        }),

      removeShop: shopId =>
        set(s => prune((s.shops ?? []).filter(sh => sh.info.id !== shopId), s.activeShopId)),

      clearCart: () => set({ shops: [], activeShopId: null, orderType: 'place' }),
    }),
    {
      name: 'lassi-cart',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        // v3 = modèle multi-boutiques. Toute version antérieure (baskets mono-boutique)
        // est fusionnée dans une unique boutique à partir de l'ancien shopInfo.
        if (version >= 3) return persisted as CartState;

        const old = (persisted ?? {}) as {
          shopInfo?: CartShopInfo | null;
          baskets?: { items?: CartItem[] }[];
          items?: CartItem[];
          orderType?: OrderType;
        };

        const merged = new Map<string, CartItem>();
        const legacyItems: CartItem[] = [
          ...(Array.isArray(old.items) ? old.items : []),
          ...((old.baskets ?? []).flatMap(b => (Array.isArray(b.items) ? b.items : []))),
        ];
        for (const it of legacyItems) {
          const ex = merged.get(it.id);
          merged.set(it.id, ex ? { ...ex, qty: ex.qty + it.qty } : { ...it });
        }
        const items = Array.from(merged.values());

        const shops: CartShop[] =
          old.shopInfo && items.length > 0 ? [{ info: old.shopInfo, items }] : [];

        return {
          shops,
          activeShopId: shops[0]?.info.id ?? null,
          orderType: old.orderType ?? 'place',
        } as CartState;
      },
    },
  ),
);

export default useCartStore;
