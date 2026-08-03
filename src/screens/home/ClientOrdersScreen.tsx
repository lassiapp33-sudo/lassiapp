import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { ClientOrder } from '../../types/clientOrders';
import * as clientOrdersService from '../../services/clientOrders';
import { Livraison } from '../../services/livraisons';
import { getLivraisonsDemandeur } from '../../services/livraisons';
import { prepareReorder } from '../../services/reorder';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import AvisForm from '../../components/avis/AvisForm';
import { Avis } from '../../types/avis';
import MascoHomeBtn from '../../components/MascoHomeBtn';
import { IcoBack } from '../../components/icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ClientOrderCard } from '../../components/orders/ClientOrderCard';
import { LivraisonHistoriqueCard } from '../../components/livraison/LivraisonHistoriqueCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryItem =
  | { kind: 'order'; data: ClientOrder }
  | { kind: 'livraison'; data: Livraison };

type HistoryFilter = 'all' | 'orders';

// ─── Icône état vide ─────────────────────────────────────────────────────────

const IcoEmpty = () => (
  <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" strokeWidth={1} strokeLinecap="round">
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={colors.border} />
    <Path d="M3 6h18" stroke={colors.border} />
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={colors.border} />
  </Svg>
);

const FILTER_TABS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'orders', label: 'Commandes boutiques' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeAndSort(orders: ClientOrder[], livraisons: Livraison[]): HistoryItem[] {
  const items: HistoryItem[] = [
    ...orders.map<HistoryItem>(o => ({ kind: 'order', data: o })),
    ...livraisons.map<HistoryItem>(l => ({ kind: 'livraison', data: l })),
  ];
  items.sort((a, b) => {
    const da = a.kind === 'order' ? a.data.createdAt : a.data.created_at;
    const db = b.kind === 'order' ? b.data.createdAt : b.data.created_at;
    return new Date(db).getTime() - new Date(da).getTime();
  });
  return items;
}

function applyFilter(items: HistoryItem[], filter: HistoryFilter): HistoryItem[] {
  if (filter === 'orders') return items.filter(i => i.kind === 'order');
  return items;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onExplore: () => void;
  onGoToCart?: (shopId: string, shopName: string) => void;
  onViewReceipt?: (orderId: string) => void;
}

export default function ClientOrdersScreen({
  onBack,
  onExplore,
  onGoToCart,
  onViewReceipt,
}: Props) {
  const user = useAuthStore(s => s.user);

  const [allItems, setAllItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [avisTarget, setAvisTarget] = useState<{
    orderId: string;
    shopId: string;
    shopName: string;
    existing?: Avis;
  } | null>(null);

  const addItem = useCartStore(s => s.addItem);
  const updateQty = useCartStore(s => s.updateQty);
  const clearCart = useCartStore(s => s.clearCart);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) { setLoading(false); setRefreshing(false); return; }

      if (!isRefresh) {
        const [cachedOrders, cachedLivraisons] = await Promise.all([
          getFastCache<ClientOrder[]>(`orders_${user.id}`),
          getFastCache<Livraison[]>(`livraisons_${user.id}`),
        ]);
        if (cachedOrders || cachedLivraisons) {
          setAllItems(mergeAndSort(cachedOrders ?? [], cachedLivraisons ?? []));
          setLoading(false);
          Promise.all([
            clientOrdersService.getClientOrders(user.id),
            getLivraisonsDemandeur(),
          ]).then(([freshOrders, freshLivraisons]) => {
            setAllItems(mergeAndSort(freshOrders, freshLivraisons));
            setFastCache(`orders_${user.id}`, freshOrders);
            setFastCache(`livraisons_${user.id}`, freshLivraisons);
          }).catch(() => {});
          return;
        }
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [orders, livraisons] = await Promise.all([
          clientOrdersService.getClientOrders(user.id),
          getLivraisonsDemandeur(),
        ]);
        setAllItems(mergeAndSort(orders, livraisons));
        setFastCache(`orders_${user.id}`, orders);
        setFastCache(`livraisons_${user.id}`, livraisons);
      } catch {
        setError('Impossible de charger ton historique. Tire vers le bas pour réessayer.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = (orderId: string) => {
    Alert.alert(
      'Annuler la commande',
      'Es-tu sûr de vouloir annuler ? Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await clientOrdersService.cancelOrder(orderId);
              setAllItems(prev =>
                prev.map(item =>
                  item.kind === 'order' && item.data.id === orderId
                    ? { ...item, data: { ...item.data, status: 'cancelled' as const } }
                    : item,
                ),
              );
            } catch {
              Alert.alert('Erreur', "Impossible d'annuler. Réessaie.");
            }
          },
        },
      ],
    );
  };

  const handleReorder = async (order: ClientOrder) => {
    if (!order.shopId) {
      Alert.alert('Indisponible', 'Impossible de retracer ce commerce. Réessaie.');
      return;
    }
    setReorderingId(order.id);
    try {
      const result = await prepareReorder(order.shopId, order.commerceName, order.items);

      if (!result.ok) {
        Alert.alert('Commander à nouveau', result.error);
        return;
      }

      clearCart();
      for (const item of result.added) {
        addItem(result.shopInfo, {
          id: item.id,
          name: item.name,
          emoji: item.emoji,
          price: item.price,
        });
        if (item.qty > 1) updateQty(item.id, item.qty);
      }

      const lines: string[] = [];
      if (result.removed.length > 0) {
        const unavail = result.removed.filter(r => r.reason === 'unavailable').map(r => r.name);
        const deleted = result.removed.filter(r => r.reason === 'deleted').map(r => r.name);
        if (unavail.length) lines.push(`Articles épuisés retirés : ${unavail.join(', ')}`);
        if (deleted.length) lines.push(`Articles supprimés retirés : ${deleted.join(', ')}`);
      }
      if (result.priceChanged.length > 0) {
        lines.push('Certains prix ont été mis à jour depuis ta dernière commande.');
      }

      const msg =
        lines.length > 0
          ? `Ton panier est prêt.\n\n${lines.join('\n')}`
          : 'Ton panier est prêt. Vérifie et confirme ta commande.';

      Alert.alert('Commander à nouveau', msg, [
        {
          text: 'Voir le panier',
          onPress: () => onGoToCart?.(result.shopId, result.shopName),
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => clearCart(),
        },
      ]);
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue. Réessaie.');
    } finally {
      setReorderingId(null);
    }
  };

  const displayed = useMemo(
    () => applyFilter(allItems, filter),
    [allItems, filter],
  );

  return (
    <>
      <LassiScreen
        header={
          <>
            <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
              <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
                <IcoBack />
              </TouchableOpacity>
              <Text style={s.title}>Mon historique</Text>
              <MascoHomeBtn />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.tabsScroll}
              contentContainerStyle={s.tabsRow}
            >
              {FILTER_TABS.map(tab => {
                const on = tab.id === filter;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[s.tab, on ? s.tabOn : s.tabOff]}
                    onPress={() => setFilter(tab.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.tabTxt, on ? s.tabTxtOn : s.tabTxtOff]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        }
      >
        {/* ── Contenu ── */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorTxt}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => load()} activeOpacity={0.8}>
              <Text style={s.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={item => `${item.kind}-${item.data.id}`}
            style={s.scroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={6}
            windowSize={5}
            initialNumToRender={10}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            renderItem={({ item }) => {
              if (item.kind === 'livraison') {
                return <LivraisonHistoriqueCard livraison={item.data} />;
              }
              const order = item.data;
              return (
                <ClientOrderCard
                  order={order}
                  onCancel={handleCancel}
                  onReorder={handleReorder}
                  isReordering={reorderingId === order.id}
                  onViewReceipt={onViewReceipt}
                  onLeaveAvis={
                    order.status === 'completed' && !order.avisId
                      ? () => {
                          setAvisTarget({
                            orderId: order.id,
                            shopId: order.shopId,
                            shopName: order.commerceName,
                          });
                        }
                      : undefined
                  }
                />
              );
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <IcoEmpty />
                <Text style={s.emptyTitle}>
                  {allItems.length === 0
                    ? "Tu n'as pas encore d'activité."
                    : 'Aucune entrée dans cette catégorie.'}
                </Text>
                {allItems.length === 0 && (
                  <>
                    <Text style={s.emptySub}>Découvre les prestataires près de toi.</Text>
                    <TouchableOpacity style={s.exploreBtn} onPress={onExplore} activeOpacity={0.85}>
                      <Text style={s.exploreTxt}>Explorer l'accueil</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            }
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        )}
      </LassiScreen>

      {/* ── Formulaire avis ── */}
      {avisTarget && (
        <AvisForm
          visible
          shopId={avisTarget.shopId}
          shopName={avisTarget.shopName}
          orderId={avisTarget.orderId}
          existingAvis={avisTarget.existing}
          onClose={() => setAvisTarget(null)}
          onSaved={() => {
            setAvisTarget(null);
            load();
          }}
        />
      )}
    </>
  );
}

// ─── Styles écran ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },

  tabsScroll: { height: 52, flexGrow: 0 },
  tabsRow: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tabOn: { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent },
  tabOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt: { fontFamily: fonts.title, fontSize: 12 },
  tabTxtOn: { color: colors.bg },
  tabTxtOff: { color: colors.muted },

  scroll: { flex: 1 },
  content: { paddingTop: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  retryTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
  },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  exploreBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  exploreTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
});
