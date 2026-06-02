import { useEffect, useRef } from 'react';
import { AppState }          from 'react-native';
import { supabase }          from '../lib/supabase';
import { Notif }             from '../store/notificationsStore';
import { rowToNotif }        from '../services/notifications';

/**
 * Abonnement Realtime sur la table notifications, filtré par userId.
 * Appelle onNewNotif à chaque nouvelle notification insérée.
 */
export function useRealtimeNotifications(
  userId:     string | null,
  onNewNotif: (notif: Notif) => void,
) {
  const callbackRef = useRef(onNewNotif);
  callbackRef.current = onNewNotif;

  useEffect(() => {
    if (!userId) return;

    const subscribe = () => {
      const channel = supabase
        .channel(`notifs:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => callbackRef.current(rowToNotif(payload.new)),
        )
        .subscribe();
      return channel;
    };

    let channel = subscribe();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.removeChannel(channel);
        channel = subscribe();
      }
    });

    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
