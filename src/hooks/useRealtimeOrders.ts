import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { IncomingOrder } from '../types/orders';
import * as ordersService from '../services/orders';

/**
 * Abonnement Realtime sur la table orders, filtré par shopId.
 * - onNewOrder  : appelé quand une commande est insérée (avec items chargés)
 * - onStatusChange : appelé quand le statut d'une commande change
 */
export function useRealtimeOrders(
  shopId: string | null,
  onNewOrder: (order: IncomingOrder) => void,
  onStatusChange?: (orderId: string, status: string, prepTime?: string) => void,
) {
  const onNewRef = useRef(onNewOrder);
  const onStatusRef = useRef(onStatusChange);
  onNewRef.current = onNewOrder;
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (!shopId) return;

    const subscribe = () => {
      const channel = supabase
        .channel(`orders:${shopId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
          async payload => {
            // Recharger les commandes du shop pour avoir les items associés
            const orders = await ordersService.getShopOrders(shopId);
            const found = orders.find(o => o.id === payload.new.id);
            if (found) onNewRef.current(found);
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
          payload => {
            onStatusRef.current?.(
              payload.new.id,
              payload.new.status,
              payload.new.prep_time ?? undefined,
            );
          },
        )
        .subscribe();
      return channel;
    };

    let channel = subscribe();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        supabase.removeChannel(channel);
        channel = subscribe();
      }
    });

    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [shopId]);
}
