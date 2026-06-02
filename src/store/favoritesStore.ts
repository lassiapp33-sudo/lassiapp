import { create }           from 'zustand';
import * as favService      from '../services/favorites';

interface FavoritesState {
  favorites:      string[];   // shopIds en favori
  loading:        boolean;

  // Chargement depuis Supabase
  loadFavorites: () => Promise<void>;

  // Toggle — optimiste + write-through Supabase
  toggleFavorite: (shopId: string) => void;

  setLoading: (v: boolean) => void;
}

const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favorites: [],
  loading:   false,

  setLoading: (v) => set({ loading: v }),

  loadFavorites: async () => {
    set({ loading: true });
    try {
      const ids = await favService.getFavoriteIds();
      set({ favorites: ids, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  toggleFavorite: (shopId) => {
    const { favorites } = get();
    const isFav = favorites.includes(shopId);

    // Mise à jour optimiste
    set({
      favorites: isFav
        ? favorites.filter(id => id !== shopId)
        : [...favorites, shopId],
    });

    favService.toggleFavorite(shopId, isFav).catch(console.warn);
  },
}));

export default useFavoritesStore;
