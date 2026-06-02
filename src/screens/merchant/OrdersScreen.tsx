import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Vibration, RefreshControl,
} from 'react-native';

import OrdersHeader  from '../../components/orders/OrdersHeader';
import StatusTabs    from '../../components/orders/StatusTabs';
import OrderCard     from '../../components/orders/OrderCard';
import PrepTimeSheet from '../../components/orders/PrepTimeSheet';
import { colors, fonts } from '../../theme';
import { IncomingOrder, MerchantTab, OrderStatus } from '../../types/orders';
import useOrdersStore      from '../../store/ordersStore';
import useShopStore        from '../../store/shopStore';
import { useRealtimeOrders } from '../../hooks/useRealtimeOrders';

// ─── État vide par onglet ──────────────────────────────────────────────────────

const EMPTY: Record<MerchantTab, { emoji: string; text: string; sub: string }> = {
  all:      { emoji: '📋', text: 'Aucune commande pour le moment.',  sub: 'Votre vitrine est en ligne, attendez vos premiers clients !' },
  new:      { emoji: '✅', text: 'Aucune nouvelle commande.',        sub: 'Les nouvelles commandes apparaîtront ici en temps réel.'     },
  preparing:{ emoji: '🚀', text: 'Aucune commande en cours.',        sub: 'Confirmez une nouvelle commande pour la démarrer.'           },
  done:     { emoji: '🎉', text: 'Aucune commande terminée.',        sub: 'Vos commandes terminées apparaîtront ici.'                  },
  refused:  { emoji: '📭', text: 'Aucune commande annulée.',         sub: 'Les commandes refusées ou annulées apparaîtront ici.'       },
};

function EmptyState({ tab }: { tab: MerchantTab }) {
  const m = EMPTY[tab];
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{m.emoji}</Text>
      <Text style={styles.emptyTxt}>{m.text}</Text>
      <Text style={styles.emptySub}>{m.sub}</Text>
    </View>
  );
}

// ─── Filtre des commandes par onglet ─────────────────────────────────────────

function filterByTab(orders: IncomingOrder[], tab: MerchantTab): IncomingOrder[] {
  switch (tab) {
    case 'new':       return orders.filter(o => o.status === 'new');
    case 'preparing': return orders.filter(o => o.status === 'preparing' || o.status === 'ready');
    case 'done':      return orders.filter(o => o.status === 'done');
    case 'refused':   return orders.filter(o => o.status === 'refused');
    default:          return orders;
  }
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function OrdersScreen({ onBack }: Props) {
  const shopId         = useShopStore(s => s.shopId);
  const orders         = useOrdersStore(s => s.orders);
  const loading        = useOrdersStore(s => s.loading);
  const setOrderStatus = useOrdersStore(s => s.setOrderStatus);
  const removeOrder    = useOrdersStore(s => s.removeOrder);
  const addOrder       = useOrdersStore(s => s.addOrder);
  const loadOrders     = useOrdersStore(s => s.loadOrders);

  const [activeTab,    setActiveTab]    = useState<MerchantTab>('new');
  const [acceptTarget, setAcceptTarget] = useState<IncomingOrder | null>(null);
  const [showPrep,     setShowPrep]     = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);

  useEffect(() => {
    if (shopId) loadOrders(shopId);
  }, [shopId]);

  const handleRefresh = useCallback(async () => {
    if (!shopId) return;
    setRefreshing(true);
    await loadOrders(shopId).catch(() => {});
    setRefreshing(false);
  }, [shopId, loadOrders]);

  // Nouvelle commande en temps réel → vibration + bascule sur l'onglet Nouvelles
  const handleNewOrder = useCallback((order: IncomingOrder) => {
    addOrder(order);
    Vibration.vibrate(400);
    setActiveTab('new');
  }, [addOrder]);

  // Changement de statut en temps réel (autre appareil / Edge Function)
  const handleStatusChange = useCallback((orderId: string, status: string) => {
    const valid: OrderStatus[] = ['new','preparing','ready','done','refused'];
    if (valid.includes(status as OrderStatus)) {
      setOrderStatus(orderId, status as OrderStatus);
    }
  }, [setOrderStatus]);

  useRealtimeOrders(shopId, handleNewOrder, handleStatusChange);

  // Compteurs par onglet
  const counts: Record<MerchantTab, number> = {
    all:       orders.length,
    new:       orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing' || o.status === 'ready').length,
    done:      orders.filter(o => o.status === 'done').length,
    refused:   orders.filter(o => o.status === 'refused').length,
  };

  const displayed = filterByTab(orders, activeTab);

  const advance = (id: string, to: OrderStatus, prepTime?: string) =>
    setOrderStatus(id, to, prepTime);

  const openPrepSheet = (order: IncomingOrder) => {
    setAcceptTarget(order);
    setShowPrep(true);
  };

  const handleAccept = (prepTime: string) => {
    if (!acceptTarget) return;
    advance(acceptTarget.id, 'preparing', prepTime);
    setActiveTab('preparing');
    setShowPrep(false);
    setAcceptTarget(null);
  };

  return (
    <View style={styles.root}>
      <OrdersHeader newCount={counts.new} onBack={onBack} />
      <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {displayed.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            displayed.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onAccept={() => openPrepSheet(order)}
                onRefuse={() => removeOrder(order.id)}
                onChat={() => { /* TODO : ouvrir chat avec le client */ }}
                onReady={() => { advance(order.id, 'ready'); setActiveTab('preparing'); }}
                onDone={() => {  advance(order.id, 'done');  setActiveTab('done');      }}
              />
            ))
          )}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      <PrepTimeSheet
        visible={showPrep}
        order={acceptTarget}
        onAccept={handleAccept}
        onClose={() => setShowPrep(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingTop: 4 },
  loader:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    alignItems: 'center',
    marginTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    textAlign: 'center',
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
