import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

import OrdersHeader  from '../../components/orders/OrdersHeader';
import StatusTabs    from '../../components/orders/StatusTabs';
import OrderCard     from '../../components/orders/OrderCard';
import PrepTimeSheet from '../../components/orders/PrepTimeSheet';
import { colors, fonts } from '../../theme';
import { IncomingOrder, OrderStatus } from '../../types/orders';
import useOrdersStore from '../../store/ordersStore';

// ─── Message état vide ────────────────────────────────────────────────────────

function EmptyState({ status }: { status: OrderStatus }) {
  const MESSAGES: Record<OrderStatus, { emoji: string; text: string }> = {
    new:       { emoji: '✅', text: 'Aucune nouvelle commande.' },
    preparing: { emoji: '👨‍🍳', text: 'Aucune commande en cours.' },
    ready:     { emoji: '🛎️', text: 'Aucune commande prête.' },
    done:      { emoji: '🎉', text: 'Aucune commande terminée.' },
  };
  const m = MESSAGES[status];
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{m.emoji}</Text>
      <Text style={styles.emptyTxt}>{m.text}</Text>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function OrdersScreen({ onBack }: Props) {
  const orders         = useOrdersStore(s => s.orders);
  const setOrderStatus = useOrdersStore(s => s.setOrderStatus);
  const removeOrder    = useOrdersStore(s => s.removeOrder);

  const [activeTab,    setActiveTab]    = useState<OrderStatus>('new');
  const [acceptTarget, setAcceptTarget] = useState<IncomingOrder | null>(null);
  const [showPrep,     setShowPrep]     = useState(false);

  // ── Calcul des compteurs par statut ────────────────────────────────────────
  const counts: Record<OrderStatus, number> = {
    new:       orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    done:      orders.filter(o => o.status === 'done').length,
  };

  // Commandes de l'onglet actif
  const displayed = orders.filter(o => o.status === activeTab);

  // ── Transitions de statut ──────────────────────────────────────────────────

  const advance = (id: string, to: OrderStatus, prepTime?: string) =>
    setOrderStatus(id, to, prepTime);

  // Ouvre le choix du temps de préparation avant d'accepter
  const openPrepSheet = (order: IncomingOrder) => {
    setAcceptTarget(order);
    setShowPrep(true);
  };

  // Confirme l'acceptation avec le temps choisi → passe en "preparing"
  const handleAccept = (prepTime: string) => {
    if (!acceptTarget) return;
    advance(acceptTarget.id, 'preparing', prepTime);
    setActiveTab('preparing');
    setShowPrep(false);
    setAcceptTarget(null);
  };

  // Refuse → retire la commande du store
  const handleRefuse = (id: string) => removeOrder(id);

  return (
    <View style={styles.root}>
      <OrdersHeader newCount={counts.new} onBack={onBack} />
      <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <EmptyState status={activeTab} />
        ) : (
          displayed.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onAccept={() => openPrepSheet(order)}
              onRefuse={() => handleRefuse(order.id)}
              onChat={() => { /* TODO : ouvrir chat avec le client */ }}
              onReady={() => { advance(order.id, 'ready'); setActiveTab('ready'); }}
              onDone={() => { advance(order.id, 'done');  setActiveTab('done');  }}
            />
          ))
        )}
        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Bottom sheet de choix du délai de préparation */}
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
  content: { paddingTop: 4, flexGrow: 1 },

  empty: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
