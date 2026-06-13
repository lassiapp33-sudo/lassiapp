import { create } from 'zustand';
import * as notifsService from '../services/notifications';
import logger from '../utils/logger';

export type NotifType = 'order' | 'pay' | 'vip' | 'msg';

export interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  group: 'today' | 'week';
  targetId?: string;
  data?: Record<string, unknown>;
}

interface NotifState {
  notifications: Notif[];
  loading: boolean;

  // Chargement depuis Supabase
  loadNotifications: () => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotif: (notif: Notif) => void;

  setLoading: (v: boolean) => void;
}

const useNotificationsStore = create<NotifState>()((set, get) => ({
  notifications: [],
  loading: false,

  setLoading: v => set({ loading: v }),

  loadNotifications: async () => {
    set({ loading: true });
    try {
      const notifs = await notifsService.getNotifications();
      set({ notifications: notifs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async id => {
    const prev = get().notifications;
    set(state => ({
      notifications: state.notifications.map(n => (n.id === id ? { ...n, unread: false } : n)),
    }));
    try {
      await notifsService.markAsRead(id);
    } catch (err) {
      set({ notifications: prev });
      logger.warn('[notificationsStore] markRead:', err);
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, unread: false })),
    }));
    try {
      await notifsService.markAllRead();
    } catch (err) {
      set({ notifications: prev });
      logger.warn('[notificationsStore] markAllRead:', err);
    }
  },

  // Utilisé par le hook Realtime pour injecter une nouvelle notif en live
  addNotif: notif =>
    set(state => {
      if (state.notifications.some(n => n.id === notif.id)) return state;
      return { notifications: [notif, ...state.notifications] };
    }),
}));

export default useNotificationsStore;
