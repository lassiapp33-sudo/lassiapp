import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { rawSecureStorage } from '../lib/secureStorage';
import { getInitials } from '../utils/getInitials';
import useCartStore from './cartStore';
import useDebtsStore from './debtsStore';

export type UserRole = 'client' | 'merchant' | 'livreur';

export interface AuthUser {
  id: string; // UUID Supabase
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  initial: string; // dérivée du nom
  avatarUrl?: string; // URL Supabase Storage (optionnel)
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean; // true pendant la vérification de session au démarrage
  hasSeenOnboarding: boolean;

  // Appelée après login/register réussi ou récupération de session
  setUser: (user: AuthUser | null) => void;
  setLoading: (v: boolean) => void;
  logout: () => void;
  updateProfile: (
    updates: Partial<Pick<AuthUser, 'name' | 'phone' | 'email' | 'avatarUrl'>>,
  ) => void;
  setOnboardingSeen: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true, // démarrage = en attente de la vérif session
      hasSeenOnboarding: false,

      setUser: user => {
        const currentId = get().user?.id;
        // Vider le panier si l'utilisateur change (autre compte sur même appareil)
        if (currentId && user?.id && currentId !== user.id) {
          useCartStore.getState().clearCart();
        }
        set({ user, isAuthenticated: !!user, isLoading: false });
      },

      setLoading: isLoading => set({ isLoading }),

      logout: () => {
        useCartStore.getState().clearCart();
        useDebtsStore.getState().reset();
        set({ user: null, isAuthenticated: false });
      },

      updateProfile: updates => {
        const user = get().user;
        if (!user) return;
        const updated = { ...user, ...updates };
        if (updates.name) updated.initial = getInitials(updates.name);
        set({ user: updated });
      },

      setOnboardingSeen: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name: 'lassi-auth',
      storage: createJSONStorage(() => rawSecureStorage),
      // PII chiffrées (AES-256, clé dans Keychain/Keystore via expo-secure-store).
      // La source de vérité reste Supabase (getSessionUser), le cache sert de filet de sécurité
      // quand le réseau est lent : l'app s'ouvre immédiatement, la session est vérifiée en arrière-plan.
      partialize: state => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export default useAuthStore;
