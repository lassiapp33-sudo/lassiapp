import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'fr' | 'en';

interface LanguageState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const useLanguageStore = create<LanguageState>()(
  persist(
    set => ({
      lang: 'fr',
      setLang: l => set({ lang: l }),
    }),
    {
      name: 'lassi_lang',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useLanguageStore;
