import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInitials } from '../utils/getInitials';

export type UserRole = 'client' | 'merchant';

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

      setUser: user =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: isLoading => set({ isLoading }),

      logout: () => set({ user: null, isAuthenticated: false }),

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
      storage: createJSONStorage(() => AsyncStorage),
      // On ne persiste QUE hasSeenOnboarding.
      // La session auth est gérée par Supabase via AsyncStorage (lib/supabase.ts).
      partialize: state => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
    },
  ),
);

export default useAuthStore;
