import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

import DashHeader      from '../../components/merchant/DashHeader';
import EarningsCard    from '../../components/merchant/EarningsCard';
import QuickActions    from '../../components/merchant/QuickActions';
import OrderCard, { MerchantOrder } from '../../components/merchant/OrderCard';
import VipScoring      from '../../components/merchant/VipScoring';
import MerchantBottomNav,
  { MerchantTab, MERCHANT_NAV_HEIGHT }
                       from '../../components/merchant/MerchantBottomNav';
import { colors, fonts, TOP_INSET } from '../../theme';
import useAuthStore          from '../../store/authStore';
import useOrdersStore        from '../../store/ordersStore';
import useNotificationsStore from '../../store/notificationsStore';

// ─── Sous-composant section header ────────────────────────────────────────────

function SectionHeader({ title, linkLabel, onLink }: {
  title: string; linkLabel?: string; onLink?: () => void;
}) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {linkLabel && (
        <TouchableOpacity onPress={onLink} activeOpacity={0.7}>
          <Text style={styles.secLink}>{linkLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}


// Destinations possibles depuis le dashboard
type NavDest = 'debts' | 'orders' | 'store' | 'sale' | 'visibility' | 'profile';

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate?: (dest: NavDest) => void;
}

export default function MerchantDashboard({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<MerchantTab>('dashboard');
  const merchantName = useAuthStore(s => s.user?.name ?? 'Commerçant');
  const notifCount   = useNotificationsStore(s => s.notifications.filter(n => n.unread).length);

  // Adapter les commandes du store au format de la carte résumée du dashboard
  const storeOrders  = useOrdersStore(s => s.orders);
  const dashOrders: MerchantOrder[] = storeOrders
    .filter(o => o.status === 'new' || o.status === 'preparing')
    .slice(0, 3)
    .map(o => ({
      id:      o.id,
      initial: o.initial,
      name:    o.clientName,
      items:   o.items.map(i => `${i.qty}× ${i.name}`).join(' · '),
      timeAgo: o.timeLabel,
      status:  o.status as 'new' | 'preparing',
      price:   o.total,
    }));

  // Câblage du BottomNav → navigation externe
  const handleNavPress = (tab: MerchantTab) => {
    setActiveTab(tab);
    if (tab === 'debts')   onNavigate?.('debts');
    if (tab === 'orders')  onNavigate?.('orders');
    if (tab === 'sale')    onNavigate?.('sale');
    if (tab === 'profile') onNavigate?.('profile');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: TOP_INSET + 10, paddingBottom: MERCHANT_NAV_HEIGHT + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① Salutation + cloche */}
        <DashHeader name={merchantName} isVip notifCount={notifCount} />

        {/* ② Carte recette du jour */}
        <EarningsCard
          amount={47500}
          changeLabel="▲ +12% par rapport à hier"
          orders={23}
          viaLassi={8}
          debts={15000}
        />

        {/* ③ 4 actions rapides — câblage vers les sous-écrans */}
        <QuickActions onPress={(key) => onNavigate?.(key as NavDest)} />

        {/* ④ Commandes en cours */}
        <SectionHeader title="Commandes en cours" linkLabel="Tout voir" onLink={() => onNavigate?.('orders')} />
        {dashOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyOrdersTxt}>Aucune commande en cours</Text>
          </View>
        ) : (
          dashOrders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))
        )}

        {/* ⑤ Scoring VIP */}
        <View style={{ marginTop: 14 }}>
          <SectionHeader title="Mon classement" linkLabel="Détails" onLink={() => {}} />
        </View>
        <VipScoring
          rank="N°1 Tangana de Dakar"
          subtitle="Tu es champion de la semaine"
          renewIn="3j"
          progress={0.78}
          progressLabel="78% vers le maintien"
        />
      </ScrollView>

      {/* ⑥ Barre de navigation prestataire */}
      <MerchantBottomNav active={activeTab} onPress={handleNavPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  emptyOrders: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyOrdersTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  secTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  secLink: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
});
