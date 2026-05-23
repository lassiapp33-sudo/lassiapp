import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInitials } from '../utils/getInitials';

export type UserRole = 'client' | 'merchant';

export interface AuthUser {
  name:    string;
  phone:   string;
  email:   string;
  role:    UserRole;
  initial: string;  // dérivée du nom
}

interface AuthState {
  user:              AuthUser | null;
  isAuthenticated:   boolean;
  hasSeenOnboarding: boolean;
  // Actions
  login:             (data: Omit<AuthUser, 'initial'>) => void;
  logout:            () => void;
  updateProfile:     (updates: Partial<Pick<AuthUser, 'name' | 'phone' | 'email'>>) => void;
  setOnboardingSeen: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:              null,
      isAuthenticated:   false,
      hasSeenOnboarding: false,

      login: (data) => set({
        isAuthenticated: true,
        user: { ...data, initial: getInitials(data.name) },
      }),

      logout: () => set({ isAuthenticated: false, user: null }),

      updateProfile: (updates) => {
        const user = get().user;
        if (!user) return;
        const updated = { ...user, ...updates };
        if (updates.name) updated.initial = getInitials(updates.name);
        set({ user: updated });
      },

      setOnboardingSeen: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name:    'lassi-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useAuthStore;
