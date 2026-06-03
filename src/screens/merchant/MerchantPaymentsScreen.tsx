import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, RefreshControl, AppState,
} from 'react-native';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import {
  MerchantPayment, PaymentFilter, PaymentStatus, DayRevenue,
} from '../../types/merchantPayments';
import * as paymentsService from '../../services/merchantPayments';
import useAuthStore  from '../../store/authStore';
import { supabase }   from '../../lib/supabase';
import MascoHomeBtn   from '../../components/MascoHomeBtn';
import { IcoBack, IcoClose } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.success} />
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

const IcoReceipt = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1} strokeLinecap="round">
    <Path d="M4 2v20l3-2 2.5 2L12 20l2.5 2L17 20l3 2V2l-3 2-2.5-2L12 4l-2.5-2L7 4Z"
      stroke={colors.border} />
    <Path d="M9 9h6M9 13h6M9 17h3" stroke={colors.border} />
  </Svg>
);

const IcoTrend = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke={colors.success} />
    <Polyline points="16 7 22 7 22 13" stroke={colors.success} />
  </Svg>
);

// ─── Config statuts ───────────────────────────────────────────────────────────

const STATUS_CFG: Record<PaymentStatus, { label: string; dot: string; text: string; bg: string }> = {
  pending:  { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)'  },
  success:  { label: 'Reçu',       dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)'  },
  failed:   { label: 'Échoué',     dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
  refunded: { label: 'Remboursé',  dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
};

const FILTER_TABS: Array<{ id: PaymentFilter; label: string }> = [
  { id: 'all',  label: 'Tous'         },
  { id: 'wave', label: 'Wave'         },
  { id: 'om',   label: 'Orange Money' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function filterPayments(payments: MerchantPayment[], filter: PaymentFilter): MerchantPayment[] {
  if (filter === 'all') return payments;
  return payments.filter(p => p.method === filter);
}

// ─── Graphique 7 jours ────────────────────────────────────────────────────────

const BAR_MAX_H = 64;

function WeekChart({ data }: { data: DayRevenue[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  return (
    <View style={chart.wrap}>
      <View style={chart.header}>
        <Text style={chart.title}>Revenus — 7 derniers jours</Text>
        {selected !== null && data[selected].amount > 0 && (
          <Text style={chart.tooltip}>
            {data[selected].label} · {formatPrice(data[selected].amount)}
          </Text>
        )}
      </View>
      <View style={chart.bars}>
        {data.map((d, i) => {
          const barH  = d.amount > 0 ? Math.max((d.amount / maxAmount) * BAR_MAX_H, 6) : 3;
          const isSel = selected === i;
          const isToday = i === data.length - 1;
          return (
            <TouchableOpacity
              key={d.date}
              style={chart.barCol}
              onPress={() => setSelected(isSel ? null : i)}
              activeOpacity={0.75}
            >
              {d.amount > 0 && (
                <Text style={chart.barAmt}>{shortAmount(d.amount)}</Text>
              )}
              <View style={[
                chart.bar,
                { height: barH },
                isSel  && chart.barSel,
                isToday && chart.barToday,
                d.amount === 0 && chart.barZero,
              ]} />
              <Text style={[chart.barLabel, isToday && chart.barLabelToday]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Reçu modal ───────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  payment: MerchantPayment | null;
  onClose: () => void;
}

function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  if (!payment) return null;
  const cfg = STATUS_CFG[payment.status];

  return (
    <Modal
      visible={!!payment}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modal.overlay}>
        <View style={modal.card}>
          {/* Header */}
          <View style={modal.header}>
            <Text style={modal.title}>Reçu de paiement</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={modal.closeBtn}>
              <IcoClose />
            </TouchableOpacity>
          </View>

          {/* Statut */}
          <View style={[modal.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[modal.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[modal.statusTxt, { color: cfg.text }]}>{cfg.label}</Text>
            {payment.status === 'success' && <IcoCheck />}
          </View>

          {/* Client */}
          <View style={modal.row}>
            <Text style={modal.rowLabel}>Client</Text>
            <Text style={modal.rowValue}>{payment.clientName}</Text>
          </View>
          {payment.clientPhone && (
            <View style={modal.row}>
              <Text style={modal.rowLabel}>Téléphone</Text>
              <Text style={modal.rowValue}>{payment.clientPhone}</Text>
            </View>
          )}

          {/* Articles */}
          {payment.items.length > 0 && (
            <View style={modal.itemsSection}>
              <Text style={modal.rowLabel}>Articles</Text>
              {payment.items.map((item, i) => (
                <View key={i} style={modal.itemRow}>
                  <Text style={modal.itemName}>
                    {item.qty && item.qty > 1 ? `${item.qty}× ` : ''}{item.name}
                  </Text>
                  {item.price != null && (
                    <Text style={modal.itemPrice}>{formatPrice(item.price)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={modal.divider} />

          {/* Montant */}
          <View style={modal.row}>
            <Text style={modal.rowLabel}>Montant reçu</Text>
            <Text style={modal.amountValue}>{formatPrice(payment.amount)}</Text>
          </View>

          {/* Méthode */}
          <View style={modal.row}>
            <Text style={modal.rowLabel}>Moyen de paiement</Text>
            <View style={modal.methodRow}>
              {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
              <Text style={modal.rowValue}>
                {payment.method === 'wave' ? 'Wave' : 'Orange Money'}
              </Text>
            </View>
          </View>

          {/* Référence */}
          {payment.reference && (
            <View style={modal.row}>
              <Text style={modal.rowLabel}>Référence</Text>
              <Text style={[modal.rowValue, modal.reference]}>{payment.reference}</Text>
            </View>
          )}

          {/* Date */}
          <View style={modal.row}>
            <Text style={modal.rowLabel}>Date</Text>
            <Text style={modal.rowValue}>{formatDateTime(payment.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Carte paiement ───────────────────────────────────────────────────────────

interface PaymentCardProps {
  payment:   MerchantPayment;
  onReceipt: () => void;
}

function PaymentCard({ payment, onReceipt }: PaymentCardProps) {
  const cfg = STATUS_CFG[payment.status];

  return (
    <View style={pc.wrap}>
      {/* En-tête : client + badge statut */}
      <View style={pc.top}>
        <View style={pc.avatar}>
          <Text style={pc.avatarTxt}>{payment.clientName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={pc.info}>
          <Text style={pc.client} numberOfLines={1}>{payment.clientName}</Text>
          <Text style={pc.date}>{formatDateTime(payment.createdAt)}</Text>
        </View>
        <View style={[pc.badge, { backgroundColor: cfg.bg }]}>
          <View style={[pc.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[pc.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Articles */}
      {payment.items.length > 0 && (
        <Text style={pc.items} numberOfLines={1}>
          {payment.items.map(i =>
            i.qty && i.qty > 1 ? `${i.qty}× ${i.name}` : i.name
          ).join(', ')}
        </Text>
      )}

      <View style={pc.divider} />

      {/* Pied : montant + méthode + bouton reçu */}
      <View style={pc.footer}>
        <Text style={pc.amount}>{formatPrice(payment.amount)}</Text>

        <View style={pc.method}>
          {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
          <Text style={pc.methodTxt}>
            {payment.method === 'wave' ? 'Wave' : 'OM'}
          </Text>
        </View>

        {payment.reference && (
          <Text style={pc.ref} numberOfLines={1}>#{payment.reference.slice(-6).toUpperCase()}</Text>
        )}

        {payment.status === 'success' && (
          <TouchableOpacity style={pc.receiptBtn} onPress={onReceipt} activeOpacity={0.8}>
            <Text style={pc.receiptTxt}>Voir le reçu</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function MerchantPaymentsScreen({ onBack }: Props) {
  const user = useAuthStore(s => s.user);

  const [payments,   setPayments]   = useState<MerchantPayment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<PaymentFilter>('all');
  const [receipt,    setReceipt]    = useState<MerchantPayment | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await paymentsService.getMerchantPayments(user.id);
      setPayments(data);
    } catch {
      setError('Impossible de charger les paiements. Tire vers le bas pour réessayer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime — nouveaux paiements reçus
  useEffect(() => {
    if (!user?.id) return;

    const subscribe = () => {
      const ch = supabase
        .channel(`payments:${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'payments',
            filter: `prestataire_id=eq.${user.id}`,
          },
          () => load(),   // recharge simplement la liste
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

  const stats     = paymentsService.computeStats(payments);
  const chartData = paymentsService.getLast7Days(payments);
  const displayed = filterPayments(payments, filter);

  return (
    <View style={s.root}>
      {/* ── En-tête ── */}
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
                  <Text style={s.statLabel}>Total reçu</Text>
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
          <WeekChart data={chartData} />

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
                  <Text style={[s.tabTxt, on ? s.tabTxtOn : s.tabTxtOff]}>
                    {tab.label}
                  </Text>
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
                  ? 'Aucun paiement reçu pour le moment.'
                  : 'Aucun paiement dans cette catégorie.'}
              </Text>
              {payments.length === 0 && (
                <Text style={s.emptySub}>
                  Vos revenus apparaîtront ici dès votre première commande.
                </Text>
              )}
            </View>
          ) : (
            displayed.map(p => (
              <PaymentCard
                key={p.id}
                payment={p}
                onReceipt={() => setReceipt(p)}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </View>
  );
}

// ─── Styles graphique ─────────────────────────────────────────────────────────

const chart = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tooltip: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 11,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: BAR_MAX_H + 28,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barAmt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  bar: {
    width: 22,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  barSel:   { backgroundColor: colors.accent },
  barToday: { backgroundColor: 'rgba(253,207,52,0.45)' },
  barZero:  { backgroundColor: colors.border, opacity: 0.4 },
  barLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  barLabelToday: { color: colors.accent },
});

// ─── Styles modal reçu ────────────────────────────────────────────────────────

const modal = StyleSheet.create({
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
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  closeBtn: {
    width: 34, height: 34,
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
  rowValue: { color: colors.white, fontFamily: fonts.ui,   fontSize: 13, flex: 1, textAlign: 'right' },
  amountValue: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },
  reference: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemsSection: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName:  { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  itemPrice: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  divider:   { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});

// ─── Styles carte paiement ────────────────────────────────────────────────────

const pc = StyleSheet.create({
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
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },
  info: { flex: 1, minWidth: 0 },
  client: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  date:   { color: colors.muted, fontFamily: fonts.body,  fontSize: 10.5, marginTop: 1 },
  badge:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: radius.pill, flexShrink: 0,
  },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 10.5 },
  items:    { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, marginBottom: 8 },
  divider:  { height: 1, backgroundColor: colors.border, marginBottom: 10 },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount:   { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15, flex: 1 },
  method:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  methodTxt:{ color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  ref:      { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  receiptBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  receiptTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
});

// ─── Styles écran ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, textAlign: 'center',
    color: colors.white, fontFamily: fonts.titleXL, fontSize: 18,
  },
  scroll:   { flex: 1 },
  content:  { paddingTop: 8 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent },
  retryTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  statsCard: {
    marginHorizontal: 18, marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row' },
  statsRow2: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  statCell:  { flex: 1, padding: 16 },
  statCell2: { flex: 1, padding: 14 },
  statTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginBottom: 4 },
  statBig:   { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },
  statMed:   { color: colors.white, fontFamily: fonts.title,   fontSize: 14 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 18, marginBottom: 14,
  },
  tab: {
    flex: 1, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tabOn:     { backgroundColor: colors.accent },
  tabOff:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt:    { fontFamily: fonts.title, fontSize: 12 },
  tabTxtOn:  { color: colors.bg    },
  tabTxtOff: { color: colors.muted },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15, textAlign: 'center' },
  emptySub:   { color: colors.muted, fontFamily: fonts.body,  fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
