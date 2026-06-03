import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import {
  ClientOrder, ClientOrderStatus,
  CommerceType, OrderFilter,
} from '../../types/clientOrders';
import * as clientOrdersService from '../../services/clientOrders';
import { prepareReorder }       from '../../services/reorder';
import useAuthStore              from '../../store/authStore';
import useCartStore              from '../../store/cartStore';
import AvisForm                  from '../../components/avis/AvisForm';
import { Avis }                  from '../../types/avis';
import * as avisService          from '../../services/avis';
import MascoHomeBtn              from '../../components/MascoHomeBtn';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoFood = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" stroke={colors.accent} />
    <Path d="M7 2v20" stroke={colors.accent} />
    <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" stroke={colors.accent} />
  </Svg>
);

const IcoBeauty = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="m6 3 6 6 6-6" stroke={colors.accent} />
    <Path d="M20 21a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2" stroke={colors.accent} />
    <Path d="m8 21 8-18" stroke={colors.accent} />
  </Svg>
);

const IcoService = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      stroke={colors.accent} />
  </Svg>
);

const IcoOther = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={colors.accent} />
    <Rect x={14} y={14} width={7} height={7} rx={1} stroke={colors.accent} />
  </Svg>
);

const IcoWave = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M2 12c2-4 4-6 6-6s4 6 6 6 4-6 6-6" stroke={colors.muted} />
  </Svg>
);

const IcoOM = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={9} stroke={colors.muted} />
    <Path d="M12 8v8M8 12h8" stroke={colors.muted} strokeLinecap="round" />
  </Svg>
);

const IcoEmpty = () => (
  <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" strokeWidth={1} strokeLinecap="round">
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke={colors.border} />
    <Path d="M3 6h18" stroke={colors.border} />
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={colors.border} />
  </Svg>
);

const IcoReorder = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 4v6h6M23 20v-6h-6" stroke={colors.bg} />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke={colors.bg} />
  </Svg>
);

// ─── Config statique ─────────────────────────────────────────────────────────

const TYPE_ICONS: Record<CommerceType, React.ReactElement> = {
  food:    <IcoFood />,
  beauty:  <IcoBeauty />,
  service: <IcoService />,
  other:   <IcoOther />,
};

const TYPE_LABELS: Record<CommerceType, string> = {
  food:    'Restauration',
  beauty:  'Beauté & coiffure',
  service: 'Service',
  other:   'Autre',
};

const STATUS_CFG: Record<ClientOrderStatus, { label: string; dot: string; text: string; bg: string }> = {
  pending:     { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)'  },
  in_progress: { label: 'En cours',   dot: '#F0A847', text: '#F0A847', bg: 'rgba(240,168,71,0.12)'  },
  ready:       { label: 'Prête ✓',    dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
  completed:   { label: 'Terminée',   dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)'  },
  cancelled:   { label: 'Annulée',    dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
};

const FILTER_TABS: Array<{ id: OrderFilter; label: string }> = [
  { id: 'all',       label: 'Toutes'    },
  { id: 'active',    label: 'En cours'  },
  { id: 'completed', label: 'Terminées' },
  { id: 'cancelled', label: 'Annulées'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyFilter(orders: ClientOrder[], filter: OrderFilter): ClientOrder[] {
  switch (filter) {
    case 'active':    return orders.filter(o => ['pending','in_progress','ready'].includes(o.status));
    case 'completed': return orders.filter(o => o.status === 'completed');
    case 'cancelled': return orders.filter(o => o.status === 'cancelled');
    default:          return orders;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function summarizeItems(items: { name: string; qty?: number }[]): string {
  if (!items.length) return '—';
  const parts = items.slice(0, 3).map(i =>
    i.qty && i.qty > 1 ? `${i.qty}× ${i.name}` : i.name
  );
  return parts.join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '');
}

// ─── Carte commande ───────────────────────────────────────────────────────────

const IcoReceipt = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={colors.accent} />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={colors.accent} />
  </Svg>
);

interface OrderCardProps {
  order:          ClientOrder;
  onCancel:       (id: string) => void;
  onReorder:      (order: ClientOrder) => void;
  isReordering:   boolean;
  onLeaveAvis?:   () => void;
  onViewReceipt?: (orderId: string) => void;
}

function OrderCard({ order, onCancel, onReorder, isReordering, onLeaveAvis, onViewReceipt }: OrderCardProps) {
  const cfg        = STATUS_CFG[order.status];
  const isPending  = order.status === 'pending';
  const canReorder = order.status === 'completed' || order.status === 'cancelled';
  const canAvis    = order.status === 'completed' && !order.avisId;
  const hasReceipt = !!order.receiptCode && order.receiptStatus !== 'aucun';

  return (
    <View style={card.wrap}>
      {/* Nom + badge statut */}
      <View style={card.top}>
        <Text style={card.name} numberOfLines={1}>{order.commerceName}</Text>
        <View style={[card.badge, { backgroundColor: cfg.bg }]}>
          <View style={[card.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[card.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Type de commerce */}
      <View style={card.typeRow}>
        {TYPE_ICONS[order.commerceType]}
        <Text style={card.typeLabel}>{TYPE_LABELS[order.commerceType]}</Text>
      </View>

      {/* Articles */}
      <Text style={card.items} numberOfLines={2}>{summarizeItems(order.items)}</Text>

      {/* Notes */}
      {!!order.notes && (
        <Text style={card.notes} numberOfLines={1}>« {order.notes} »</Text>
      )}

      <View style={card.divider} />

      {/* Pied : montant + paiement + date */}
      <View style={card.footer}>
        <Text style={card.amount}>{order.totalAmount.toLocaleString('fr-FR')} FCFA</Text>
        <View style={card.payRow}>
          {order.paymentMethod === 'wave' ? <IcoWave /> : <IcoOM />}
          <Text style={card.payLabel}>
            {order.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}
          </Text>
        </View>
        <Text style={card.date}>{formatDate(order.createdAt)}</Text>
      </View>

      {/* Bouton reçu */}
      {hasReceipt && (
        <TouchableOpacity
          style={[
            card.receiptBtn,
            order.receiptStatus === 'utilise' && card.receiptBtnUsed,
            order.receiptStatus === 'expire'  && card.receiptBtnExpired,
          ]}
          onPress={() => onViewReceipt?.(order.id)}
          activeOpacity={0.85}
        >
          <IcoReceipt />
          <Text style={[
            card.receiptTxt,
            order.receiptStatus === 'utilise' && { color: colors.muted },
            order.receiptStatus === 'expire'  && { color: colors.danger },
          ]}>
            {order.receiptStatus === 'utilise'
              ? '✓ Reçu utilisé'
              : order.receiptStatus === 'expire'
                ? 'Reçu expiré'
                : 'Voir le reçu'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bouton annulation (pending uniquement) */}
      {isPending && (
        <TouchableOpacity
          style={card.cancelBtn}
          onPress={() => onCancel(order.id)}
          activeOpacity={0.8}
        >
          <Text style={card.cancelTxt}>Annuler la commande</Text>
        </TouchableOpacity>
      )}

      {/* Invitation avis (commande terminée sans avis) */}
      {canAvis && (
        <TouchableOpacity style={card.avisBtn} onPress={onLeaveAvis} activeOpacity={0.85}>
          <Text style={card.avisBtnTxt}>⭐ Comment s'est passée ta commande ?</Text>
        </TouchableOpacity>
      )}

      {/* Avis déjà laissé */}
      {order.status === 'completed' && order.avisId && (
        <View style={card.avisLeft}>
          <Text style={card.avisLeftTxt}>✓ Avis publié</Text>
        </View>
      )}

      {/* Bouton reorder (commandes terminées / annulées) */}
      {canReorder && (
        <TouchableOpacity
          style={[card.reorderBtn, isReordering && card.reorderBtnLoading]}
          onPress={() => !isReordering && onReorder(order)}
          activeOpacity={0.85}
          disabled={isReordering}
        >
          {isReordering ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <>
              <IcoReorder />
              <Text style={card.reorderTxt}>Commander à nouveau</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onBack:          () => void;
  onExplore:       () => void;
  onGoToCart?:     (shopId: string, shopName: string) => void;
  onViewReceipt?:  (orderId: string) => void;
}

export default function ClientOrdersScreen({ onBack, onExplore, onGoToCart, onViewReceipt }: Props) {
  const user = useAuthStore(s => s.user);

  const [orders,       setOrders]       = useState<ClientOrder[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [filter,       setFilter]       = useState<OrderFilter>('all');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [avisTarget,   setAvisTarget]   = useState<{
    orderId: string; shopId: string; shopName: string; existing?: Avis;
  } | null>(null);

  const addItem    = useCartStore(s => s.addItem);
  const updateQty  = useCartStore(s => s.updateQty);
  const clearCart  = useCartStore(s => s.clearCart);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await clientOrdersService.getClientOrders(user.id);
      setOrders(data);
    } catch {
      setError('Impossible de charger tes commandes. Tire vers le bas pour réessayer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

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
              setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' as const } : o)
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

      // Construire le nouveau panier
      clearCart();
      for (const item of result.added) {
        addItem(result.shopInfo, { id: item.id, name: item.name, emoji: item.emoji, price: item.price });
        if (item.qty > 1) updateQty(item.id, item.qty);
      }

      // Préparer le message de confirmation
      const lines: string[] = [];
      if (result.removed.length > 0) {
        const unavail = result.removed.filter(r => r.reason === 'unavailable').map(r => r.name);
        const deleted = result.removed.filter(r => r.reason === 'deleted').map(r => r.name);
        if (unavail.length) lines.push(`Articles épuisés retirés : ${unavail.join(', ')}`);
        if (deleted.length) lines.push(`Articles supprimés retirés : ${deleted.join(', ')}`);
      }
      if (result.priceChanged.length > 0) {
        lines.push('⚠️ Certains prix ont été mis à jour depuis ta dernière commande.');
      }

      const msg = lines.length > 0
        ? `Ton panier est prêt !\n\n${lines.join('\n')}`
        : 'Ton panier est prêt ! Vérifie et confirme ta commande.';

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

  const displayed = applyFilter(orders, filter);

  return (
    <>
    <LassiScreen
      header={
        <>
          <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
            <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
              <IcoBack />
            </TouchableOpacity>
            <Text style={s.title}>Mes commandes</Text>
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
              <Text style={[s.tabTxt, on ? s.tabTxtOn : s.tabTxtOff]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
              })}
          </ScrollView>
        </>
      }
    >
      {/* ── Contenu ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()} activeOpacity={0.8}>
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {displayed.length === 0 ? (
            <View style={s.empty}>
              <IcoEmpty />
              <Text style={s.emptyTitle}>
                {orders.length === 0
                  ? "Tu n'as pas encore de commandes."
                  : "Aucune commande dans cette catégorie."}
              </Text>
              {orders.length === 0 && (
                <>
                  <Text style={s.emptySub}>
                    Découvre les prestataires près de toi !
                  </Text>
                  <TouchableOpacity
                    style={s.exploreBtn}
                    onPress={onExplore}
                    activeOpacity={0.85}
                  >
                    <Text style={s.exploreTxt}>Explorer l'accueil</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            displayed.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={handleCancel}
                onReorder={handleReorder}
                isReordering={reorderingId === order.id}
                onViewReceipt={onViewReceipt}
                onLeaveAvis={order.status === 'completed' && !order.avisId ? () => {
                  setAvisTarget({
                    orderId:  order.id,
                    shopId:   order.shopId,
                    shopName: order.commerceName,
                  });
                } : undefined}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
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
        onSaved={() => { setAvisTarget(null); load(); }}
      />
    )}
  </>
  );
}

// ─── Styles carte ─────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  name: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 15,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeTxt: {
    fontFamily: fonts.ui,
    fontSize: 11,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typeLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },
  items: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  notes: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amount: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 14,
    flex: 1,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  date: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  receiptBtn: {
    marginTop: 10,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.4)',
    backgroundColor: 'rgba(253,207,52,.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  receiptBtnUsed: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  receiptBtnExpired: {
    borderColor: 'rgba(224,122,122,.35)',
    backgroundColor: 'rgba(224,122,122,.07)',
  },
  receiptTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  cancelTxt: {
    color: colors.danger,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  reorderBtn: {
    marginTop: 10,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reorderBtnLoading: {
    opacity: 0.7,
  },
  reorderTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 13.5,
  },
  avisBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.4)',
    backgroundColor: 'rgba(253,207,52,.08)',
    alignItems: 'center',
  },
  avisBtnTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  avisLeft: {
    marginTop: 8,
    alignItems: 'center',
  },
  avisLeftTxt: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },
});

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
  tabOn:     { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent },
  tabOff:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt:    { fontFamily: fonts.title, fontSize: 12 },
  tabTxtOn:  { color: colors.bg },
  tabTxtOff: { color: colors.muted },

  scroll:  { flex: 1 },
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
