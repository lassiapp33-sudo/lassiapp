import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotifType = 'order' | 'pay' | 'vip' | 'msg';

export interface Notif {
  id:     string;
  type:   NotifType;
  title:  string;
  body:   string;
  time:   string;
  unread: boolean;
  group:  'today' | 'week';
}

interface NotifState {
  notifications: Notif[];

  markRead:    (id: string) => void;
  markAllRead: () => void;
  addNotif:    (notif: Omit<Notif, 'id'>) => void;
}

const INITIAL_NOTIFS: Notif[] = [
  {
    id: 'n1', type: 'order', group: 'today',
    title: 'Commande prête ! 🎉',
    body:  'Ta commande chez Tangana Diallo est prête à récupérer.',
    time:  'il y a 4 min', unread: true,
  },
  {
    id: 'n2', type: 'pay', group: 'today',
    title: 'Paiement confirmé',
    body:  '1 200 F payés via Wave. Reçu #A427-2K6 disponible.',
    time:  'il y a 6 min', unread: true,
  },
  {
    id: 'n3', type: 'vip', group: 'week',
    title: 'Ton favori est N°1 cette semaine 🏆',
    body:  'Tangana Diallo & Frères est dans le Top 3 VIP de Dakar.',
    time:  'il y a 2 jours', unread: false,
  },
  {
    id: 'n4', type: 'msg', group: 'week',
    title: 'Nouveau message',
    body:  'Salon Khadija Beauté t\'a répondu.',
    time:  'il y a 3 jours', unread: false,
  },
];

const useNotificationsStore = create<NotifState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFS,

      markRead: (id) => set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, unread: false } : n
        ),
      })),

      markAllRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, unread: false })),
      })),

      addNotif: (notif) => set((state) => ({
        notifications: [
          { ...notif, id: `notif_${Date.now()}` },
          ...state.notifications,
        ],
      })),
    }),
    {
      name:    'lassi-notifs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useNotificationsStore;
