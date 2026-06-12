import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DashHeader from '../../components/merchant/DashHeader';
import EarningsCard from '../../components/merchant/EarningsCard';
import QuickActions from '../../components/merchant/QuickActions';
import OrderCard, { MerchantOrder } from '../../components/merchant/OrderCard';
import WelcomeRewardModal from '../../components/merchant/WelcomeRewardModal';
import MerchantBottomNav, {
  MerchantTab,
  MERCHANT_NAV_HEIGHT,
} from '../../components/merchant/MerchantBottomNav';
import { colors, fonts, TOP_INSET } from '../../theme';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
import useOrdersStore from '../../store/ordersStore';
import useDebtsStore from '../../store/debtsStore';
import useNotificationsStore from '../../store/notificationsStore';
import useLocationStore from '../../store/locationStore';
import { getRecompenseBienvenue } from '../../services/classementService';

// ─── Sous-composant section header ────────────────────────────────────────────

function SectionHeader({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
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
type NavDest =
  | 'debts'
  | 'orders'
  | 'store'
  | 'messages'
  | 'visibility'
  | 'profile'
  | 'notifications'
  | 'assistant'
  | 'aroundme'
  | 'avis'
  | 'terrains'
  | 'classement'
  | 'offre_quartier';

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate?: (dest: NavDest) => void;
  onNotifPress?: () => void;
}

export default function MerchantDashboard({ onNavigate, onNotifPress }: Props) {
  const [activeTab, setActiveTab] = useState<MerchantTab>('dashboard');
  const [welcomeReward, setWelcomeReward] = useState<{ carrouselProduits: number } | null>(null);

  // Auth
  const userId = useAuthStore(s => s.user?.id);
  const merchantName = useAuthStore(s => s.user?.name ?? 'Commerçant');
  const notifCount = useNotificationsStore(s => s.notifications.filter(n => n.unread).length);
  const loadNotifications = useNotificationsStore(s => s.loadNotifications);
  const zoneName = useLocationStore(s => s.zoneName);
  const refreshLocation = useLocationStore(s => s.refreshLocation);

  // Shop
  const shopId = useShopStore(s => s.shopId);
  const shopIsVip = useShopStore(s => s.profile?.isVip ?? false);
  const shopType = useShopStore(s => s.context.shopType);
  const shopSubcategories = useShopStore(s => s.context.subcategories);
  const loadMyShop = useShopStore(s => s.loadMyShop);

  // Commandes
  const orders = useOrdersStore(s => s.orders);
  const loadOrders = useOrdersStore(s => s.loadOrders);

  // Dettes
  const debtors = useDebtsStore(s => s.debtors);
  const loadDebts = useDebtsStore(s => s.loadDebts);

  // Montage seul — initialisation unique au démarrage du dashboard
  useEffect(() => {
    loadMyShop();
    loadNotifications();
    refreshLocation(); // vraie position GPS dès le montage
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cadeau de bienvenue (4 emplacements "Offre di Quartier") — affiché une
  // seule fois, mémorisé par compte via AsyncStorage.
  useEffect(() => {
    if (!userId) return;
    const seenKey = `welcome_reward_seen_${userId}`;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(seenKey);
        if (seen) return;
        const reward = await getRecompenseBienvenue(userId);
        if (reward?.est_actif) {
          setWelcomeReward({ carrouselProduits: reward.carrousel_produits });
        }
      } catch {
        // silencieux — le cadeau reste consultable depuis Offre di Quartier
      }
    })();
  }, [userId]);

  const dismissWelcomeReward = () => {
    setWelcomeReward(null);
    if (userId) AsyncStorage.setItem(`welcome_reward_seen_${userId}`, '1').catch(() => {});
  };

  useEffect(() => {
    if (!shopId) return;
    loadOrders(shopId);
    loadDebts(shopId);
  }, [shopId, loadOrders, loadDebts]);

  // ── Calculs réels ──────────────────────────────────────────────────────────
  const activeOrders = orders.filter(o => o.status === 'new' || o.status === 'preparing');
  const doneOrders = orders.filter(o => o.status === 'done');
  const totalEarnings = doneOrders.reduce((sum, o) => sum + o.total, 0);
  const totalDebt = debtors.reduce((sum, d) => sum + d.amount, 0);
  const debtorsWithDebt = debtors.filter(d => d.amount > 0).length;

  // Commandes à afficher sur le dashboard (actives, max 3)
  const dashOrders: MerchantOrder[] = activeOrders.slice(0, 3).map(o => ({
    id: o.id,
    initial: o.initial,
    name: o.clientName,
    items: o.items.map(i => `${i.qty}× ${i.name}`).join(' · '),
    timeAgo: o.timeLabel,
    status: o.status as 'new' | 'preparing',
    price: o.total,
  }));

  // Câblage du BottomNav → navigation externe
  const handleNavPress = (tab: MerchantTab) => {
    setActiveTab(tab);
    if (tab === 'debts') onNavigate?.('debts');
    if (tab === 'orders') onNavigate?.('orders');
    if (tab === 'messages') onNavigate?.('messages');
    if (tab === 'profile') onNavigate?.('profile');
    if (tab === 'assistant') onNavigate?.('assistant');
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
        {/* ① Salutation + cloche + zone réelle */}
        <DashHeader
          name={merchantName}
          isVip={shopIsVip}
          notifCount={notifCount}
          zoneName={zoneName}
          onNotifPress={onNotifPress}
          onLocation={refreshLocation}
        />

        {/* ② Recette du jour — données réelles */}
        <EarningsCard
          amount={totalEarnings}
          changeLabel={
            doneOrders.length > 0
              ? `${doneOrders.length} commande${doneOrders.length > 1 ? 's' : ''} finalisée${doneOrders.length > 1 ? 's' : ''}`
              : 'Aucune commande finalisée'
          }
          orders={orders.length}
          viaLassi={orders.length}
          debts={totalDebt}
        />

        {/* ③ 4 actions rapides — compteurs réels */}
        <QuickActions
          onPress={key => onNavigate?.(key as NavDest)}
          debtCount={debtorsWithDebt}
          showTerrains={shopType === 'terrains'}
          isSlotShop={shopSubcategories.some(
            s => s === 'reservation_terrain_foot' || s === 'reservation_terrain_basket',
          )}
        />

        {/* ④ Commandes en cours */}
        <SectionHeader
          title="Commandes en cours"
          linkLabel="Tout voir"
          onLink={() => onNavigate?.('orders')}
        />
        {dashOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyOrdersTxt}>Aucune commande en cours</Text>
          </View>
        ) : (
          dashOrders.map(order => <OrderCard key={order.id} order={order} />)
        )}
      </ScrollView>

      <MerchantBottomNav active={activeTab} onPress={handleNavPress} />

      <WelcomeRewardModal
        visible={!!welcomeReward}
        carrouselProduits={welcomeReward?.carrouselProduits ?? 4}
        onClose={dismissWelcomeReward}
        onDiscover={() => {
          dismissWelcomeReward();
          onNavigate?.('offre_quartier');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
