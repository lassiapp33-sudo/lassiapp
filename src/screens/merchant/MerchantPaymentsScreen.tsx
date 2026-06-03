import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, AppState,
} from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import {
  MerchantPayment, PaymentFilter, PaymentStatus,
} from '../../types/merchantPayments';
import * as paymentsService from '../../services/merchantPayments';
import useAuthStore  from '../../store/authStore';
import { supabase }   from '../../lib/supabase';
import MascoHomeBtn   from '../../components/MascoHomeBtn';
import { IcoBack }    from '../../components/icons';
import { formatPrice } from '../../utils/format';
import LoadingSpinner  from '../../components/LoadingSpinner';
import { PaymentWeekChart }    from '../../components/merchant/PaymentWeekChart';
import { PaymentReceiptModal } from '../../components/merchant/PaymentReceiptModal';
import { MerchantPaymentCard } from '../../components/merchant/MerchantPaymentCard';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoReceipt = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1} strokeLinecap="round">
    <Path d="M4 2v20l3-2 2.5 2L12 20l2.5 2L17 20l3 2V2l-3 2-2.5-2L12 4l-2.5-2L7 4Z" stroke={colors.border} />
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
    <Path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" stroke="#F87315" />
    <Path d="M12 8v8M8 12h8" stroke="#F87315" strokeLinecap="round" />
  </Svg>
);

const IcoTrend = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke={colors.success} />
    <Polyline points="16 7 22 7 22 13" stroke={colors.success} />
  </Svg>
);

// ─── Config statuts (pour les stats card) ────────────────────────────────────

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

function filterPayments(payments: MerchantPayment[], filter: PaymentFilter): MerchantPayment[] {
  if (filter === 'all') return payments;
  return payments.filter(p => p.method === filter);
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
              <MerchantPaymentCard
                key={p.id}
                payment={p}
                onReceipt={() => setReceipt(p)}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <PaymentReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </View>
  );
}

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
