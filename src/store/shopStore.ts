import { create } from 'zustand';
import { StoreProduct, StoreCategory, StoreProfile, ShopContext } from '../types/store';
import { WeekHours } from '../services/hours';
import * as shopsService from '../services/shops';
import * as productsService from '../services/products';
import logger from '../utils/logger';

const DEFAULT_CATS: StoreCategory[] = [
  { id: 'petitdej', label: 'Petit-déj', emoji: '🍳' },
  { id: 'boissons', label: 'Boissons', emoji: '☕' },
  { id: 'plats', label: 'Plats', emoji: '🍽' },
];

function getDefaultCats(shopType: 'products' | 'services' | 'memberships' | 'terrains'): StoreCategory[] {
  if (shopType === 'services') return [{ id: 'prestations', label: 'Prestations', emoji: '✂️' }];
  if (shopType === 'memberships') return [{ id: 'formules', label: 'Formules', emoji: '🏋️' }];
  if (shopType === 'terrains') return [];
  return [{ id: 'catalogue', label: 'Catalogue', emoji: '📦' }];
}

const DEFAULT_PROFILE: StoreProfile = {
  initial: 'M',
  name: 'Ma Boutique',
  subtitle: '',
  isOpen: true,
};

interface ShopState {
  shopId: string | null;
  profile: StoreProfile;
  context: ShopContext; // type de vitrine + horaires + statut manuel + galerie
  categories: StoreCategory[];
  products: StoreProduct[];
  loading: boolean;
  shopNotFound: boolean;

  loadMyShop: () => Promise<void>;

  updateProfile: (updates: Partial<StoreProfile>) => Promise<void>;
  updateLogo: (logoUrl: string) => Promise<void>;
  saveShopDetails: (description: string, addressText: string, phone: string) => Promise<void>;
  saveProduct: (product: StoreProduct) => Promise<void>;
  toggleStock: (id: string) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
  updateOpeningHours: (hours: WeekHours | null) => Promise<void>;
  toggleManuallyClose: () => Promise<void>;
  updateGalleryUrls: (urls: string[]) => Promise<void>;

  addCategory: (label: string) => void;
  removeCategory: (id: string) => Promise<void>;

  setProducts: (products: StoreProduct[]) => void;
  setLoading: (v: boolean) => void;
}

const DEFAULT_CONTEXT: ShopContext = {
  shopType: 'products',
  openingHours: null,
  isManuallyClose: false,
  galleryUrls: [],
};

const useShopStore = create<ShopState>()((set, get) => ({
  shopId: null,
  profile: DEFAULT_PROFILE,
  context: DEFAULT_CONTEXT,
  categories: DEFAULT_CATS,
  products: [],
  loading: false,
  shopNotFound: false,

  setLoading: v => set({ loading: v }),
  setProducts: p => set({ products: p }),

  loadMyShop: async () => {
    set({ loading: true, shopNotFound: false });
    try {
      const shop = await shopsService.getMyShop();

      if (!shop) {
        set({ loading: false, shopNotFound: true });
        return;
      }

      const products = await productsService.getProducts(shop.id);

      // Dériver les catégories à partir des produits existants
      const catIds = [...new Set(products.map(p => p.category))];
      const catMeta: Record<string, { label: string; emoji: string }> = {
        petitdej: { label: 'Petit-déj', emoji: '🍳' },
        boissons: { label: 'Boissons', emoji: '☕' },
        plats: { label: 'Plats', emoji: '🍽' },
        autres: { label: 'Autres', emoji: '📦' },
        catalogue: { label: 'Catalogue', emoji: '📦' },
        prestations: { label: 'Prestations', emoji: '✂️' },
        formules: { label: 'Formules', emoji: '🏋️' },
      };
      const categories: StoreCategory[] =
        catIds.length > 0
          ? catIds.map(id => ({
              id,
              label: catMeta[id]?.label ?? id,
              emoji: catMeta[id]?.emoji ?? '📦',
            }))
          : getDefaultCats(shop.shopType);

      // Si la boutique n'a pas de logo, utiliser la photo de profil du marchand
      const { default: useAuthStore } = await import('./authStore');
      const avatarUrl = useAuthStore.getState().user?.avatarUrl;
      const logoUrl = shop.logoUrl ?? avatarUrl ?? undefined;

      set({
        shopId: shop.id,
        profile: {
          initial: shop.name.charAt(0).toUpperCase(),
          name: shop.name,
          subtitle: shop.subtitle || shop.zone,
          description: shop.description ?? undefined,
          addressText: shop.addressText ?? undefined,
          phone: shop.phone ?? undefined,
          isOpen: shop.isOpen,
          logoUrl,
          isVip: shop.isVip,
        },
        context: {
          shopType: shop.shopType,
          openingHours: shop.openingHours as WeekHours | null,
          isManuallyClose: shop.isManuallyClose,
          galleryUrls: shop.galleryUrls,
        },
        categories,
        products,
        loading: false,
      });
    } catch (err) {
      logger.warn('[shopStore] loadMyShop:', err);
      set({ loading: false });
    }
  },

  updateProfile: async updates => {
    const prev = get().profile;
    set(state => ({ profile: { ...state.profile, ...updates } }));
    const { shopId } = get();
    if (!shopId || updates.isOpen === undefined) return;
    try {
      await shopsService.updateShopStatus(shopId, updates.isOpen);
    } catch (err) {
      set({ profile: prev });
      throw err;
    }
  },

  updateLogo: async logoUrl => {
    const { shopId } = get();
    const prev = get().profile.logoUrl;
    set(state => ({ profile: { ...state.profile, logoUrl } }));
    if (!shopId) return;
    try {
      await shopsService.updateShopLogo(shopId, logoUrl);
    } catch (err) {
      set(state => ({ profile: { ...state.profile, logoUrl: prev } }));
      logger.warn('[shopStore] updateLogo:', err);
      // Non-critique — ne pas propager (l'upload Storage a déjà réussi)
    }
  },

  saveShopDetails: async (description, addressText, phone) => {
    const { shopId } = get();
    if (!shopId) return;
    const prev = get().profile;
    set(state => ({ profile: { ...state.profile, description, addressText, phone } }));
    try {
      await shopsService.updateShopDetails(shopId, { description, addressText, phone });
    } catch (err) {
      set({ profile: prev });
      throw err;
    }
  },

  updateGalleryUrls: async urls => {
    const { shopId } = get();
    if (!shopId) return;
    const prev = get().context.galleryUrls;
    set(state => ({ context: { ...state.context, galleryUrls: urls } }));
    try {
      await shopsService.updateGalleryUrls(shopId, urls);
    } catch (err) {
      set(state => ({ context: { ...state.context, galleryUrls: prev } }));
      throw err;
    }
  },

  updateLocation: async (lat, lng) => {
    const { shopId } = get();
    if (!shopId) return;
    await shopsService.updateShopLocation(shopId, lat, lng);
  },

  updateOpeningHours: async hours => {
    const { shopId } = get();
    if (!shopId) return;
    const prev = get().context.openingHours;
    set(state => ({ context: { ...state.context, openingHours: hours } }));
    try {
      await shopsService.updateOpeningHours(shopId, hours);
    } catch (err) {
      set(state => ({ context: { ...state.context, openingHours: prev } }));
      throw err;
    }
  },

  toggleManuallyClose: async () => {
    const { shopId, context } = get();
    if (!shopId) return;
    const prev = context.isManuallyClose;
    const closed = !prev;
    set(state => ({ context: { ...state.context, isManuallyClose: closed } }));
    try {
      await shopsService.updateManuallyClose(shopId, closed);
    } catch (err) {
      set(state => ({ context: { ...state.context, isManuallyClose: prev } }));
      throw err;
    }
  },

  saveProduct: async product => {
    const { shopId, products } = get();
    const exists = products.find(p => p.id === product.id);

    if (!shopId) return;

    if (exists) {
      const prev = get().products;
      set(state => ({
        products: state.products.map(p => (p.id === product.id ? product : p)),
      }));
      try {
        await productsService.updateProduct(product.id, product);
      } catch (err) {
        set({ products: prev });
        throw err;
      }
    } else {
      // Nouveau produit → attend l'UUID Supabase réel
      const saved = await productsService.addProduct(shopId, product);
      set(state => ({ products: [...state.products, saved] }));
    }

    // Recalculer les onglets en préservant les catégories personnalisées
    const allProds = get().products;
    const existing = get().categories;
    const catIds = [...new Set(allProds.map(p => p.category))];
    const catMeta: Record<string, { label: string; emoji: string }> = {
      petitdej: { label: 'Petit-déj', emoji: '🍳' },
      boissons: { label: 'Boissons', emoji: '☕' },
      plats: { label: 'Plats', emoji: '🍽' },
      autres: { label: 'Autres', emoji: '📦' },
    };
    if (catIds.length > 0) {
      const fromProducts = catIds.map(
        id =>
          existing.find(c => c.id === id) ?? {
            id,
            label: catMeta[id]?.label ?? id,
            emoji: catMeta[id]?.emoji ?? '📦',
          },
      );
      const extras = existing.filter(c => !catIds.includes(c.id));
      set({ categories: [...fromProducts, ...extras] });
    }
  },

  toggleStock: async id => {
    const { products } = get();
    const product = products.find(p => p.id === id);
    if (!product) return;
    const prev = get().products;
    set(state => ({
      products: state.products.map(p =>
        p.id === id ? { ...p, stock: p.stock === 'in' ? 'out' : 'in' } : p,
      ),
    }));
    try {
      await productsService.toggleStock(id, product.stock);
    } catch (err) {
      set({ products: prev });
      throw err;
    }
  },

  removeProduct: async id => {
    const prev = get().products;
    set(state => ({ products: state.products.filter(p => p.id !== id) }));
    try {
      await productsService.deleteProduct(id);
    } catch (err) {
      set({ products: prev });
      throw err;
    }
  },

  addCategory: label => {
    const id =
      label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || `cat_${Date.now()}`;
    const { categories } = get();
    if (categories.find(c => c.id === id || c.label.toLowerCase() === label.toLowerCase())) return;
    set(state => ({
      categories: [...state.categories, { id, label, emoji: '📦' }],
    }));
  },

  removeCategory: async catId => {
    const { categories, products } = get();
    const remaining = categories.filter(c => c.id !== catId);
    if (remaining.length === 0) return;
    const fallback = remaining[0].id;
    const toUpdate = products.filter(p => p.category === catId);
    const prevCats = categories;
    const prevProds = products;
    set({
      categories: remaining,
      products: products.map(p => (p.category === catId ? { ...p, category: fallback } : p)),
    });
    try {
      await Promise.all(
        toUpdate.map(p => productsService.updateProduct(p.id, { ...p, category: fallback })),
      );
    } catch (err) {
      set({ categories: prevCats, products: prevProds });
      throw err;
    }
  },
}));

export default useShopStore;
