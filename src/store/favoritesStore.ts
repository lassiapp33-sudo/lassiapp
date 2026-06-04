import { create } from 'zustand';
import * as favService from '../services/favorites';
import logger from '../utils/logger';

interface FavoritesState {
  favorites: string[]; // shopIds en favori
  loading: boolean;

  // Chargement depuis Supabase
  loadFavorites: () => Promise<void>;

  // Toggle — optimiste + write-through Supabase
  toggleFavorite: (shopId: string) => Promise<void>;

  setLoading: (v: boolean) => void;
}

const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favorites: [],
  loading: false,

  setLoading: v => set({ loading: v }),

  loadFavorites: async () => {
    set({ loading: true });
    try {
      const ids = await favService.getFavoriteIds();
      set({ favorites: ids, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  toggleFavorite: async shopId => {
    const { favorites } = get();
    const isFav = favorites.includes(shopId);
    set({
      favorites: isFav ? favorites.filter(id => id !== shopId) : [...favorites, shopId],
    });
    try {
      await favService.toggleFavorite(shopId, isFav);
    } catch (err) {
      // Rollback : l'icône cœur revient à son état précédent
      set({ favorites });
      logger.warn('[favoritesStore] toggleFavorite:', err);
    }
  },
}));

export default useFavoritesStore;
