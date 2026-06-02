import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useShopStore       from '../../store/shopStore';
import * as ordersService from '../../services/orders';
import * as debtsService  from '../../services/debts';
import { RevenueOrder }   from '../../services/orders';
import { Debtor }         from '../../types/debts';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IcoChevL = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" stroke={colors.white} />
  </Svg>
);

const IcoChevR = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" stroke={colors.white} />
  </Svg>
);

const IcoRefresh = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 4v6h-6" stroke={colors.accent} />
    <Path d="M1 20v-6h6" stroke={colors.accent} />
    <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
      stroke={colors.accent} />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_FR_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                         'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_FR_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun',
                         'Jul','Aoû','Sep','Oct','Nov','Déc'];

function fcfaFull(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M FCFA`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} K FCFA`;
  return `${n} FCFA`;
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameDay(a: Date, b: Date) {
  return isSameMonth(a, b) && a.getDate() === b.getDate();
}

/** Retourne la date de référence pour un offset (0 = ce mois, -1 = mois précédent…) */
function refMonth(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function monthLabel(offset: number): string {
  const d = refMonth(offset);
  return `${MONTHS_FR_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function monthShort(offset: number): string {
  const d = refMonth(offset);
  return MONTHS_FR_SHORT[d.getMonth()];
}

/** Commandes d'un mois donné (par offset). */
function ordersForMonth(orders: RevenueOrder[], offset: number): RevenueOrder[] {
  const ref = refMonth(offset);
  return orders.filter(o => isSameMonth(new Date(o.createdAt), ref));
}

/** Regroupement par jour pour le mois sélectionné. */
interface DayStat {
  day:       number;  // 1-31
  total:     number;
  confirmed: number;
  count:     number;
}

function buildDayStats(orders: RevenueOrder[], offset: number): DayStat[] {
  const ref = refMonth(offset);
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const map: Record<number, DayStat> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    map[d] = { day: d, total: 0, confirmed: 0, count: 0 };
  }
  for (const o of orders) {
    const d = new Date(o.createdAt).getDate();
    if (!map[d]) continue;
    map[d].total     += o.total;
    map[d].count     += 1;
    if (o.status === 'done') map[d].confirmed += o.total;
  }
  // Retourne seulement les jours avec des commandes
  return Object.values(map).filter(d => d.count > 0).reverse();
}

/** Stats globales sur les 6 mois pour le graphique. */
interface MonthBar6 {
  offset: number;
  short:  string;
  total:  number;
  confirmed: number;
}

function build6MonthBars(orders: RevenueOrder[]): MonthBar6[] {
  return [-5,-4,-3,-2,-1,0].map(offset => {
    const arr = ordersForMonth(orders, offset);
    return {
      offset,
      short:     monthShort(offset),
      total:     arr.reduce((s, o) => s + o.total, 0),
      confirmed: arr.filter(o => o.status === 'done').reduce((s, o) => s + o.total, 0),
    };
  });
}

// ─── Composant barre 6 mois ───────────────────────────────────────────────────

function MonthBarItem({
  bar, max, selected, onPress,
}: {
  bar: MonthBar6; max: number; selected: boolean; onPress: () => void;
}) {
  const H    = 80;
  const pct  = max > 0 ? bar.total / max : 0;
  const barH = Math.max(3, Math.round(pct * H));
  const confH = bar.total > 0 ? Math.round(barH * (bar.confirmed / bar.total)) : 0;

  return (
    <TouchableOpacity style={mb.col} onPress={onPress} activeOpacity={0.75}>
      <View style={[mb.track, { height: H }]}>
        <View style={[mb.fillBg, { height: barH },
          selected && { backgroundColor: 'rgba(253,207,52,.4)' }]}>
          {confH > 0 && (
            <View style={[mb.fillConf, { height: confH },
              selected && { backgroundColor: colors.accent }]} />
          )}
        </View>
      </View>
      <Text style={[mb.label, selected && mb.labelSel]}>{bar.short}</Text>
      {selected && <View style={mb.dot} />}
    </TouchableOpacity>
  );
}

const mb = StyleSheet.create({
  col:      { flex: 1, alignItems: 'center', gap: 4 },
  track:    { width: 30, justifyContent: 'flex-end' },
  fillBg:   { width: 30, borderRadius: 7, backgroundColor: 'rgba(253,207,52,.15)', justifyContent: 'flex-end' },
  fillConf: { width: 30, borderRadius: 7, backgroundColor: 'rgba(253,207,52,.6)' },
  label:    { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  labelSel: { color: colors.accent, fontFamily: fonts.ui },
  dot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
});

// ─── Écran principal ─────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function RevenueScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);

  const [orders,      setOrders]      = useState<RevenueOrder[]>([]);
  const [debtors,     setDebtors]     = useState<Debtor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  // 0 = mois actuel, -1 = mois précédent, ..., -5 = il y a 5 mois
  const [monthOffset, setMonthOffset] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!shopId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [rev, dbt] = await Promise.all([
        ordersService.getShopRevenueOrders(shopId),
        debtsService.getDebts(shopId),
      ]);
      setOrders(rev);
      setDebtors(dbt);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  // ── Calculs pour le mois sélectionné ───────────────────────────────────────
  const monthOrders = ordersForMonth(orders, monthOffset);
  const monthTotal  = monthOrders.reduce((s, o) => s + o.total, 0);
  const monthConf   = monthOrders.filter(o => o.status === 'done').reduce((s, o) => s + o.total, 0);
  const monthPend   = monthTotal - monthConf;
  const monthCount  = monthOrders.length;
  const confCount   = monthOrders.filter(o => o.status === 'done').length;

  // Aujourd'hui (seulement si mois offset = 0)
  const now         = new Date();
  const todayOrders = monthOffset === 0
    ? orders.filter(o => isSameDay(new Date(o.createdAt), now))
    : [];
  const todayTotal  = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayConf   = todayOrders.filter(o => o.status === 'done').reduce((s, o) => s + o.total, 0);

  const daySats   = buildDayStats(monthOrders, monthOffset);
  const bars6     = build6MonthBars(orders);
  const maxBar    = Math.max(...bars6.map(b => b.total), 1);
  const totalDebt = debtors.reduce((s, d) => s + d.amount, 0);

  const isCurrentMonth = monthOffset === 0;
  const isFirstMonth   = monthOffset === -5;

  return (
    <View style={s.root}>

      {/* TopBar */}
      <View style={[s.topBar, { paddingTop: TOP_INSET + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.pageTitle}>Mes revenus</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
          <IcoRefresh />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorTxt}>Impossible de charger les revenus.{'\n'}Vérifie ta connexion.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()} activeOpacity={0.8}>
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >

          {/* ── Sélecteur de mois ─────────────────────────────────────── */}
          <View style={s.monthNav}>
            <TouchableOpacity
              style={[s.chevBtn, isFirstMonth && s.chevDisabled]}
              onPress={() => !isFirstMonth && setMonthOffset(v => v - 1)}
              activeOpacity={0.7}
            >
              <IcoChevL />
            </TouchableOpacity>

            <Text style={s.monthTitle}>{monthLabel(monthOffset)}</Text>

            <TouchableOpacity
              style={[s.chevBtn, isCurrentMonth && s.chevDisabled]}
              onPress={() => !isCurrentMonth && setMonthOffset(v => v + 1)}
              activeOpacity={0.7}
            >
              <IcoChevR />
            </TouchableOpacity>
          </View>

          {/* ── Carte principale du mois ───────────────────────────────── */}
          <View style={s.mainCard}>
            <View style={s.mainCardTop}>
              <View>
                <Text style={s.mainLabel}>Total {isCurrentMonth ? 'ce mois' : monthLabel(monthOffset).split(' ')[0]}</Text>
                <Text style={s.mainAmount}>{monthTotal > 0 ? fcfaFull(monthTotal) : '0 FCFA'}</Text>
                <Text style={s.mainCount}>{monthCount} commande{monthCount !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.mainRight}>
                <View style={s.pill}>
                  <Text style={s.pillTxt}>✓ {fcfaFull(monthConf)}</Text>
                </View>
                {monthPend > 0 && (
                  <View style={[s.pill, s.pillPend]}>
                    <Text style={[s.pillTxt, { color: colors.muted }]}>⏳ {fcfaFull(monthPend)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Barre de progression confirmé/total */}
            {monthTotal > 0 && (
              <View style={s.progTrack}>
                <View style={[s.progFill, {
                  width: `${Math.round((monthConf / monthTotal) * 100)}%` as any,
                }]} />
              </View>
            )}
            {monthTotal > 0 && (
              <Text style={s.progLbl}>
                {Math.round((monthConf / monthTotal) * 100)}% confirmé
                · {confCount}/{monthCount} commandes
              </Text>
            )}
          </View>

          {/* ── Aujourd'hui (seulement mois courant) ─────────────────── */}
          {isCurrentMonth && (
            <View style={s.todayRow}>
              <View style={s.todayCard}>
                <Text style={s.todayLabel}>Aujourd'hui</Text>
                <Text style={s.todayAmount}>{todayOrders.length > 0 ? fcfaFull(todayTotal) : '—'}</Text>
                <Text style={s.todayCount}>{todayOrders.length} cmd{todayOrders.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[s.todayCard, s.todayCardConf]}>
                <Text style={s.todayLabel}>Confirmé auj.</Text>
                <Text style={[s.todayAmount, { color: colors.accent }]}>
                  {todayConf > 0 ? fcfaFull(todayConf) : '—'}
                </Text>
                <Text style={s.todayCount}>{todayOrders.filter(o => o.status === 'done').length} cmd{todayOrders.filter(o => o.status === 'done').length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          )}

          {/* ── Graphique 6 mois (barres cliquables) ─────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Vue sur 6 mois</Text>
            <View style={s.chartBox}>
              <View style={s.chart}>
                {bars6.map(bar => (
                  <MonthBarItem
                    key={bar.offset}
                    bar={bar}
                    max={maxBar}
                    selected={bar.offset === monthOffset}
                    onPress={() => setMonthOffset(bar.offset)}
                  />
                ))}
              </View>
              <View style={s.chartLegend}>
                <View style={s.lgDot} />
                <Text style={s.lgTxt}>Confirmé</Text>
                <View style={[s.lgDot, { backgroundColor: 'rgba(253,207,52,.2)', marginLeft: 10 }]} />
                <Text style={s.lgTxt}>En attente</Text>
              </View>
            </View>
          </View>

          {/* ── Détail par jour du mois sélectionné ──────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              Détail — {monthLabel(monthOffset)}
            </Text>
            {daySats.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTxt}>Aucune commande ce mois.</Text>
              </View>
            ) : (
              <View style={s.table}>
                {daySats.map((d, idx) => (
                  <View key={d.day} style={[s.tableRow, idx === 0 && s.tableRowFirst]}>
                    <View style={s.dayBadge}>
                      <Text style={s.dayNum}>{d.day}</Text>
                    </View>
                    <View style={s.tableLeft}>
                      <Text style={s.tableTotal}>{fcfaFull(d.total)}</Text>
                      <Text style={s.tableCount}>{d.count} commande{d.count !== 1 ? 's' : ''}</Text>
                    </View>
                    {d.confirmed > 0 ? (
                      <View style={s.confBadge}>
                        <Text style={s.confTxt}>✓ {fcfaFull(d.confirmed)}</Text>
                      </View>
                    ) : (
                      <View style={s.pendBadge}>
                        <Text style={s.pendTxt}>En attente</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Créances ─────────────────────────────────────────────── */}
          {totalDebt > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Créances clients</Text>
              <View style={s.debtCard}>
                <View>
                  <Text style={s.debtLabel}>Montant total dû</Text>
                  <Text style={s.debtSub}>
                    {debtors.filter(d => d.amount > 0).length} client{debtors.filter(d => d.amount > 0).length !== 1 ? 's' : ''} avec solde impayé
                  </Text>
                </View>
                <Text style={s.debtAmount}>{fcfaFull(totalDebt)}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 14, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pageTitle: { flex: 1, color: colors.white, fontFamily: fonts.titleXL, fontSize: 22 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(253,207,52,.1)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.25)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Sélecteur mois ──────────────────────────────────────────────────────────
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, marginBottom: 16,
  },
  chevBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  chevDisabled: { opacity: 0.3 },
  monthTitle: {
    color: colors.white, fontFamily: fonts.titleXL, fontSize: 17, textAlign: 'center',
  },

  // ── Carte principale mois ───────────────────────────────────────────────────
  mainCard: {
    marginHorizontal: 18, marginBottom: 14,
    backgroundColor: 'rgba(253,207,52,.07)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.25)',
    borderRadius: radius.xl, padding: 18,
  },
  mainCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  mainLabel:  { color: colors.muted,  fontFamily: fonts.body,    fontSize: 11, marginBottom: 4 },
  mainAmount: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 24 },
  mainCount:  { color: colors.muted,  fontFamily: fonts.body,    fontSize: 11, marginTop: 2 },
  mainRight:  { alignItems: 'flex-end', gap: 6 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.3)',
    borderRadius: radius.pill,
  },
  pillPend: {
    backgroundColor: 'rgba(255,255,255,.04)',
    borderColor: colors.border,
  },
  pillTxt:    { color: colors.accent, fontFamily: fonts.ui, fontSize: 10.5 },
  progTrack:  {
    height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)',
    overflow: 'hidden', marginBottom: 6,
  },
  progFill:   { height: 5, backgroundColor: colors.accent, borderRadius: 3 },
  progLbl:    { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5 },

  // ── Aujourd'hui ─────────────────────────────────────────────────────────────
  todayRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 18, marginBottom: 20,
  },
  todayCard: {
    flex: 1, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 12, alignItems: 'center', gap: 2,
  },
  todayCardConf: {
    borderColor: 'rgba(253,207,52,.25)',
    backgroundColor: 'rgba(253,207,52,.05)',
  },
  todayLabel:  { color: colors.muted,  fontFamily: fonts.body,    fontSize: 10 },
  todayAmount: { color: colors.white,  fontFamily: fonts.titleXL, fontSize: 14 },
  todayCount:  { color: colors.muted,  fontFamily: fonts.body,    fontSize: 9.5 },

  // ── Sections ────────────────────────────────────────────────────────────────
  section:      { paddingHorizontal: 18, marginBottom: 22 },
  sectionTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 15, marginBottom: 12 },

  // ── Chart ───────────────────────────────────────────────────────────────────
  chartBox: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 14,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 10 },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lgDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  lgTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 9.5 },

  // ── Tableau détail jour ──────────────────────────────────────────────────────
  table: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tableRowFirst: { borderTopWidth: 0 },
  dayBadge: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(253,207,52,.1)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.2)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dayNum:     { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 13 },
  tableLeft:  { flex: 1 },
  tableTotal: { color: colors.white, fontFamily: fonts.ui,    fontSize: 13 },
  tableCount: { color: colors.muted, fontFamily: fonts.body,  fontSize: 10, marginTop: 1 },
  confBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.25)',
    borderRadius: radius.pill,
  },
  confTxt:  { color: colors.accent, fontFamily: fonts.ui,   fontSize: 9.5 },
  pendBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,.05)' },
  pendTxt:  { color: colors.muted, fontFamily: fonts.body,  fontSize: 9.5 },

  // ── Créances ────────────────────────────────────────────────────────────────
  debtCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,90,90,.08)',
    borderWidth: 1, borderColor: 'rgba(255,90,90,.25)',
    borderRadius: radius.lg, padding: 14,
  },
  debtLabel:  { color: '#ff8a8a', fontFamily: fonts.ui,   fontSize: 13 },
  debtSub:    { color: colors.muted, fontFamily: fonts.body, fontSize: 10.5, marginTop: 2 },
  debtAmount: { color: '#ff8a8a', fontFamily: fonts.titleXL, fontSize: 14 },

  // ── États ───────────────────────────────────────────────────────────────────
  empty:    { paddingVertical: 28, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  errorTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,.3)',
    borderRadius: radius.pill,
  },
  retryTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },
});
