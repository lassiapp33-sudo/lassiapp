import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as favService from '../services/favorites';
import logger from '../utils/logger';

interface FavoritesState {
  favorites: string[];
  loading: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (shopId: string) => Promise<void>;
  setLoading: (v: boolean) => void;
}

const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      loading: false,

      setLoading: v => set({ loading: v }),

      loadFavorites: async () => {
        set({ loading: true });
        try {
          const ids = await Promise.race([
            favService.getFavoriteIds(),
            new Promise<string[]>(resolve => setTimeout(() => resolve(get().favorites), 6000)),
          ]);
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
          set({ favorites });
          logger.warn('[favoritesStore] toggleFavorite:', err);
        }
      },
    }),
    {
      name: 'lassi-favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ favorites: state.favorites }),
    },
  ),
);

export default useFavoritesStore;
