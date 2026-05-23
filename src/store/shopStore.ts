import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreProduct, StoreCategory, StoreProfile } from '../types/store';

const INITIAL_PROFILE: StoreProfile = {
  initial:  'D',
  name:     'Tangana Diallo & Frères',
  subtitle: 'Petit-déj traditionnel · Medina',
  isOpen:   true,
};

const INITIAL_CATS: StoreCategory[] = [
  { id: 'petitdej', label: 'Petit-déj', emoji: '🍳' },
  { id: 'boissons', label: 'Boissons',  emoji: '☕' },
  { id: 'plats',    label: 'Plats',     emoji: '🍽' },
];

const INITIAL_PRODUCTS: StoreProduct[] = [
  { id: 'p1',  emoji: '🥖', name: 'Pain Œuf Mayo',     desc: 'Pain croustillant, 2 œufs, mayo', price: 500,  category: 'petitdej', stock: 'in'  },
  { id: 'p2',  emoji: '🍳', name: 'Omelette spéciale', desc: '3 œufs, oignons, poivron',        price: 700,  category: 'petitdej', stock: 'in'  },
  { id: 'p3',  emoji: '🥪', name: 'Pain Viande',       desc: 'Viande hachée épicée',            price: 800,  category: 'petitdej', stock: 'out' },
  { id: 'p4',  emoji: '🍝', name: 'Spaghetti matin',   desc: 'Sauce tomate maison, épices',     price: 600,  category: 'petitdej', stock: 'in'  },
  { id: 'b1',  emoji: '☕', name: 'Café Touba',         desc: 'Bien sucré, épicé',              price: 200,  category: 'boissons', stock: 'in'  },
  { id: 'b2',  emoji: '🍵', name: 'Thé Lipton',        desc: 'Au lait concentré',              price: 250,  category: 'boissons', stock: 'in'  },
  { id: 'b3',  emoji: '🥤', name: 'Jus Bissap',        desc: 'Hibiscus frais, sucre naturel',  price: 300,  category: 'boissons', stock: 'in'  },
  { id: 'pl1', emoji: '🍚', name: 'Riz au Poisson',    desc: 'Thiébou djen, légumes',          price: 1500, category: 'plats',    stock: 'in'  },
  { id: 'pl2', emoji: '🥘', name: 'Yassa Poulet',      desc: 'Marinade oignon-citron, riz',    price: 1800, category: 'plats',    stock: 'in'  },
];

interface ShopState {
  profile:    StoreProfile;
  categories: StoreCategory[];
  products:   StoreProduct[];

  updateProfile: (updates: Partial<StoreProfile>) => void;
  saveProduct:   (product: StoreProduct) => void;
  toggleStock:   (id: string) => void;
  removeProduct: (id: string) => void;
}

const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      profile:    INITIAL_PROFILE,
      categories: INITIAL_CATS,
      products:   INITIAL_PRODUCTS,

      updateProfile: (updates) => set((state) => ({
        profile: { ...state.profile, ...updates },
      })),

      saveProduct: (product) => set((state) => {
        const idx = state.products.findIndex(p => p.id === product.id);
        if (idx >= 0) {
          const updated = [...state.products];
          updated[idx] = product;
          return { products: updated };
        }
        return { products: [...state.products, product] };
      }),

      toggleStock: (id) => set((state) => ({
        products: state.products.map(p =>
          p.id === id ? { ...p, stock: p.stock === 'in' ? 'out' : 'in' } : p
        ),
      })),

      removeProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id),
      })),
    }),
    {
      name:    'lassi-shop',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useShopStore;
