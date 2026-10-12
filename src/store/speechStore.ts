import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANNOUNCE_KEY = '@lassi_announce_orders';

interface SpeechState {
  speakingOrderId: string | null;
  announceEnabled: boolean;
  setSpeakingOrderId: (id: string | null) => void;
  setAnnounceEnabled: (v: boolean) => Promise<void>;
  loadAnnouncePreference: () => Promise<void>;
}

const useSpeechStore = create<SpeechState>()(set => ({
  speakingOrderId: null,
  announceEnabled: true,
  setSpeakingOrderId: id => set({ speakingOrderId: id }),
  setAnnounceEnabled: async (v: boolean) => {
    set({ announceEnabled: v });
    await AsyncStorage.setItem(ANNOUNCE_KEY, v ? '1' : '0');
  },
  loadAnnouncePreference: async () => {
    const stored = await AsyncStorage.getItem(ANNOUNCE_KEY);
    if (stored !== null) set({ announceEnabled: stored === '1' });
  },
}));

export default useSpeechStore;
