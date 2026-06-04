import { useEffect, useRef } from 'react';
import { AppState }          from 'react-native';
import { supabase }          from '../lib/supabase';
import * as shopsService     from '../services/shops';
import type { Shop }         from '../services/shops';

/**
 * Abonnement Realtime sur la table shops.
 * Appelle onUpdate à chaque UPDATE d'un commerce (horaires, statut manuel, etc.)
 * Suit le même pattern que useRealtimeOrders / useRealtimeMessages.
 */
export function useRealtimeShops(onUpdate: (shop: Shop) => void) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    const subscribe = () => {
      const channel = supabase
        .channel('shops:realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'shops' },
          async (payload) => {
            const shopId = (payload.new as { id: string }).id;
            const shop = await shopsService.getShopById(shopId);
            if (shop) cbRef.current(shop);
          },
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
  }, []);
}
