import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Notif } from './notificationsStore';

const KEY = '@lassi_popup_seen';
const MAX_IDS = 300;

interface State {
  queue: Notif[];
  seenIds: Set<string>;
  ready: boolean;
  loadSeenIds: () => Promise<void>;
  enqueue: (notif: Notif) => void;
  dismiss: () => void;
  resetSeenIds: () => Promise<void>;
}

const useNotifPopupStore = create<State>()((set, get) => ({
  queue: [],
  seenIds: new Set(),
  ready: false,

  loadSeenIds: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      set({ seenIds: new Set(ids), ready: true });
    } catch {
      set({ ready: true });
    }
  },

  enqueue: notif => {
    const { seenIds, ready } = get();
    if (!ready || seenIds.has(notif.id)) return;
    const next = new Set(seenIds);
    next.add(notif.id);
    const trimmed = [...next].slice(-MAX_IDS);
    AsyncStorage.setItem(KEY, JSON.stringify(trimmed)).catch(() => {});
    set(s => ({ queue: [...s.queue, notif], seenIds: new Set(trimmed) }));
  },

  dismiss: () => set(s => ({ queue: s.queue.slice(1) })),

  resetSeenIds: async () => {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    set({ seenIds: new Set(), queue: [] });
  },
}));

export default useNotifPopupStore;
