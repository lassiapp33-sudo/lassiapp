import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  AppState,
} from 'react-native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { ClientPayment } from '../../services/clientPayments';
import * as clientPaymentsService from '../../services/clientPayments';
import { PaymentFilter } from '../../types/merchantPayments';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { IcoBack, IcoClose } from '../../components/icons';
import { formatPrice, formatDateTime } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import { PaymentWeekChart } from '../../components/merchant/PaymentWeekChart';
import MascoHomeBtn from '../../components/MascoHomeBtn';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoReceipt = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1} strokeLinecap="round">
    <Path
      d="M4 2v20l3-2 2.5 2L12 20l2.5 2L17 20l3 2V2l-3 2-2.5-2L12 4l-2.5-2L7 4Z"
      stroke={colors.border}
    />
    <Path d="M9 9h6M9 13h6M9 17h3" stroke={colors.border} />
  </Svg>
);

const IcoWave = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M2 12c2-4 4-6 6-6s4 6 6 6 4-6 6-6" stroke="#1DC8F2" />
  </Svg>
);

const IcoOM = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={9} stroke="#F87315" />
    <Path d="M12 8v8M8 12h8" stroke="#F87315" strokeLinecap="round" />
  </Svg>
);

const IcoTrend = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke={colors.success} />
    <Polyline points="16 7 22 7 22 13" stroke={colors.success} />
  </Svg>
);

// ─── Statut ───────────────────────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

const STATUS_CFG: Record<PaymentStatus, { dot: string; text: string; bg: string; label: string }> =
  {
    pending: { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)' },
    success: { label: 'Payé', dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)' },
    failed: { label: 'Échoué', dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
    refunded: { label: 'Remboursé', dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  };

// ─── Carte paiement client ────────────────────────────────────────────────────

function ClientPaymentCard({
  payment,
  onReceipt,
}: {
  payment: ClientPayment;
  onReceipt: () => void;
}) {
  const cfg = STATUS_CFG[payment.status];
  const initial = payment.prestataireName.charAt(0).toUpperCase();

  return (
    <View style={cs.wrap}>
      <View style={cs.top}>
        <View style={cs.avatar}>
          <Text style={cs.avatarTxt}>{initial}</Text>
        </View>
        <View style={cs.info}>
          <Text style={cs.name} numberOfLines={1}>
            {payment.prestataireName}
          </Text>
          <Text style={cs.date}>{formatDateTime(payment.createdAt)}</Text>
        </View>
        <View style={[cs.badge, { backgroundColor: cfg.bg }]}>
          <View style={[cs.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[cs.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {payment.items.length > 0 && (
        <Text style={cs.items} numberOfLines={1}>
          {payment.items.map((i: any) => (i.qty && i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ')}
        </Text>
      )}

      <View style={cs.divider} />

      <View style={cs.footer}>
        <Text style={cs.amount}>{formatPrice(payment.amount)}</Text>
        <View style={cs.method}>
          {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
          <Text style={cs.methodTxt}>{payment.method === 'wave' ? 'Wave' : 'OM'}</Text>
        </View>
        {payment.reference && (
          <Text style={cs.ref} numberOfLines={1}>
            #{payment.reference.slice(-6).toUpperCase()}
          </Text>
        )}
        {payment.status === 'success' && (
          <TouchableOpacity style={cs.receiptBtn} onPress={onReceipt} activeOpacity={0.8}>
            <Text style={cs.receiptTxt}>Voir le reçu</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  date: { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 10.5 },
  items: { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15, flex: 1 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  methodTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  ref: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  receiptBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
});

// ─── Modal reçu client ────────────────────────────────────────────────────────

function ClientReceiptModal({
  payment,
  onClose,
}: {
  payment: ClientPayment | null;
  onClose: () => void;
}) {
  if (!payment) return null;
  const cfg = STATUS_CFG[payment.status];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.card}>
          <View style={rm.header}>
            <Text style={rm.title}>Reçu de paiement</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={rm.closeBtn}>
              <IcoClose />
            </TouchableOpacity>
          </View>

          <View style={[rm.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[rm.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[rm.statusTxt, { color: cfg.text }]}>{cfg.label}</Text>
          </View>

          <View style={rm.row}>
            <Text style={rm.rowLabel}>Commerçant</Text>
            <Text style={rm.rowValue}>{payment.prestataireName}</Text>
          </View>

          {payment.items.length > 0 && (
            <View style={rm.itemsSection}>
              <Text style={rm.rowLabel}>Articles</Text>
              {payment.items.map((item: any, i: number) => (
                <View key={i} style={rm.itemRow}>
                  <Text style={rm.itemName}>
                    {item.qty && item.qty > 1 ? `${item.qty}× ` : ''}
                    {item.name}
                  </Text>
                  {item.price != null && <Text style={rm.itemPrice}>{formatPrice(item.price)}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={rm.divider} />

          <View style={rm.row}>
            <Text style={rm.rowLabel}>Montant payé</Text>
            <Text style={rm.amountValue}>{formatPrice(payment.amount)}</Text>
          </View>

          <View style={rm.row}>
            <Text style={rm.rowLabel}>Moyen de paiement</Text>
            <View style={rm.methodRow}>
              {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
              <Text style={rm.rowValue}>{payment.method === 'wave' ? 'Wave' : 'Orange Money'}</Text>
            </View>
          </View>

          {payment.reference && (
            <View style={rm.row}>
              <Text style={rm.rowLabel}>Référence</Text>
              <Text style={[rm.rowValue, rm.reference]}>{payment.reference}</Text>
            </View>
          )}

          <View style={rm.row}>
            <Text style={rm.rowLabel}>Date</Text>
            <Text style={rm.rowValue}>{formatDateTime(payment.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginBottom: 16,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontFamily: fonts.title, fontSize: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  rowValue: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  amountValue: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },
  reference: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemsSection: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName: { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  itemPrice: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});

// ─── Onglets filtre ───────────────────────────────────────────────────────────

const FILTER_TABS: { id: PaymentFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'wave', label: 'Wave' },
  { id: 'om', label: 'Orange Money' },
];

function filterPayments(payments: ClientPayment[], filter: PaymentFilter): ClientPayment[] {
  if (filter === 'all') return payments;
  return payments.filter(p => p.method === filter);
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function ClientPaymentsScreen({ onBack }: Props) {
  const user = useAuthStore(s => s.user);

  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [receipt, setReceipt] = useState<ClientPayment | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await clientPaymentsService.getClientPayments(user.id);
        setPayments(data);
      } catch {
        setError('Impossible de charger les paiements. Tire vers le bas pour réessayer.');
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

  useEffect(() => {
    if (!user?.id) return;

    const subscribe = () => {
      const ch = supabase
        .channel(`client_payments:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'payments',
            filter: `client_id=eq.${user.id}`,
          },
          () => load(),
        )
        .subscribe();
      channelRef.current = ch;
      return ch;
    };

    let channel = subscribe();
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        supabase.removeChannel(channel);
        channel = subscribe();
      }
    });

    return () => {
      appSub.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const stats = clientPaymentsService.computeClientStats(payments);
  const chartData = clientPaymentsService.getLast7Days(payments);
  const displayed = filterPayments(payments, filter);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.title}>Mes paiements</Text>
        <MascoHomeBtn />
      </View>

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
          {/* ── Carte résumé ── */}
          <View style={s.statsCard}>
            <View style={s.statsRow}>
              <View style={s.statCell}>
                <View style={s.statTopRow}>
                  <IcoTrend />
                  <Text style={s.statLabel}>Total dépensé</Text>
                </View>
                <Text style={s.statBig}>{formatPrice(stats.totalRevenue)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <Text style={s.statLabel}>Transactions</Text>
                <Text style={s.statBig}>{stats.transactionCount}</Text>
              </View>
            </View>

            <View style={s.statsRow2}>
              <View style={s.statCell2}>
                <Text style={s.statLabel}>Ce mois</Text>
                <Text style={s.statMed}>{formatPrice(stats.monthRevenue)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell2}>
                <Text style={s.statLabel}>Méthode favorite</Text>
                <View style={s.methodRow}>
                  {stats.topMethod === 'wave' ? <IcoWave /> : <IcoOM />}
                  <Text style={s.statMed}>
                    {stats.topMethod === 'wave' ? 'Wave' : 'Orange Money'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Graphique 7 jours ── */}
          <PaymentWeekChart data={chartData} />

          {/* ── Onglets filtres ── */}
          <View style={s.tabs}>
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
          </View>

          {/* ── Liste paiements ── */}
          {displayed.length === 0 ? (
            <View style={s.empty}>
              <IcoReceipt />
              <Text style={s.emptyTitle}>
                {payments.length === 0
                  ? 'Aucun paiement effectué pour le moment.'
                  : 'Aucun paiement dans cette catégorie.'}
              </Text>
              {payments.length === 0 && (
                <Text style={s.emptySub}>
                  Vos paiements Wave et Orange Money apparaîtront ici.
                </Text>
              )}
            </View>
          ) : (
            displayed.map(p => (
              <ClientPaymentCard key={p.id} payment={p} onReceipt={() => setReceipt(p)} />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <ClientReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
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
  retryTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  statsCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row' },
  statsRow2: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statCell: { flex: 1, padding: 16 },
  statCell2: { flex: 1, padding: 14 },
  statTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginBottom: 4 },
  statBig: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },
  statMed: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.accent },
  tabOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt: { fontFamily: fonts.title, fontSize: 12 },
  tabTxtOn: { color: colors.bg },
  tabTxtOff: { color: colors.muted },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, textAlign: 'center' },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
