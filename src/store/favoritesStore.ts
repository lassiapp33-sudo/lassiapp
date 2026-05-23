import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  favorites:      string[];   // liste des shopId mis en favori
  toggleFavorite: (shopId: string) => void;
}

const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      // Prérempli : Tangana Chez Modou (isFav dans NEARBY) + Diallo (VIP ShopScreen)
      favorites: ['1', 'shop_diallo'],

      toggleFavorite: (shopId) => set((state) => {
        const isFav = state.favorites.includes(shopId);
        return {
          favorites: isFav
            ? state.favorites.filter(id => id !== shopId)
            : [...state.favorites, shopId],
        };
      }),
    }),
    {
      name:    'lassi-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useFavoritesStore;
