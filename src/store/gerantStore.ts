import { create } from 'zustand';
import { VipProfil } from '../types/vip';

interface GerantState {
  profil: VipProfil | null;
  isActive: boolean;
  setGerant: (profil: VipProfil) => void;
  clearGerant: () => void;
}

const useGerantStore = create<GerantState>((set) => ({
  profil: null,
  isActive: false,
  setGerant: (profil) => set({ profil, isActive: true }),
  clearGerant: () => set({ profil: null, isActive: false }),
}));

export default useGerantStore;
