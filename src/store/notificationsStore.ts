import { create }           from 'zustand';
import * as notifsService   from '../services/notifications';

export type NotifType = 'order' | 'pay' | 'vip' | 'msg';

export interface Notif {
  id:       string;
  type:     NotifType;
  title:    string;
  body:     string;
  time:     string;
  unread:   boolean;
  group:    'today' | 'week';
  targetId?: string;
}

interface NotifState {
  notifications: Notif[];
  loading:       boolean;

  // Chargement depuis Supabase
  loadNotifications: () => Promise<void>;

  // Mutations — optimistes + write-through Supabase
  markRead:    (id: string) => void;
  markAllRead: () => void;
  addNotif:    (notif: Notif) => void;

  setLoading: (v: boolean) => void;
}

const useNotificationsStore = create<NotifState>()((set) => ({
  notifications: [],
  loading:       false,

  setLoading: (v) => set({ loading: v }),

  loadNotifications: async () => {
    set({ loading: true });
    try {
      const notifs = await notifsService.getNotifications();
      set({ notifications: notifs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, unread: false } : n,
      ),
    }));
    notifsService.markAsRead(id).catch(console.warn);
  },

  markAllRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, unread: false })),
    }));
    notifsService.markAllRead().catch(console.warn);
  },

  // Utilisé par le hook Realtime pour injecter une nouvelle notif en live
  addNotif: (notif) => set(state => {
    if (state.notifications.some(n => n.id === notif.id)) return state;
    return { notifications: [notif, ...state.notifications] };
  }),
}));

export default useNotificationsStore;
