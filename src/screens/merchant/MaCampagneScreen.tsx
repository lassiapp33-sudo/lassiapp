import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import VisibilityHeader from '../../components/visibility/VisibilityHeader';
import useShopStore from '../../store/shopStore';
import {
  SponsoredAd,
  getMerchantAds,
  formatDuration,
} from '../../services/sponsoredAds';
import {
  ActiveSub,
  VisibilityStats,
  getActiveSub,
  getVisibilityStats,
} from '../../services/visibilityPayment';
import { formatDateLong, formatPrice } from '../../utils/format';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoDot = ({ color }: { color: string }) => (
  <Svg width={6} height={6} viewBox="0 0 6 6">
    <Circle cx={3} cy={3} r={3} fill={color} />
  </Svg>
);

const IcoEye = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke={colors.muted} />
    <Circle cx={12} cy={12} r={3} stroke={colors.muted} />
  </Svg>
);

const IcoRefresh = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 4v6h6M23 20v-6h-6" stroke={colors.accent} />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke={colors.accent} />
  </Svg>
);

// ─── Badge statut ─────────────────────────────────────────────────────────────

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <IcoDot color={color} />
      <Text style={[s.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Méthode de paiement ──────────────────────────────────────────────────────

function payMethodLabel(method: string): string {
  if (method === 'wave') return 'Wave';
  if (method === 'om') return 'Orange Money';
  return 'Crédits LASSI';
}

// ─── Carte Annonce Sponsorisée ────────────────────────────────────────────────

function AnnonceCard({ ad }: { ad: SponsoredAd }) {
  const pct = Math.min(100, Math.round((ad.actualViews / Math.max(ad.estMax, 1)) * 100));
  const statusMap = {
    active:    { label: 'En cours',  color: colors.success },
    completed: { label: 'Terminée',  color: colors.muted },
    cancelled: { label: 'Annulée',   color: colors.danger },
  };
  const st = statusMap[ad.status];

  return (
    <View style={s.card}>
      {/* Type tag */}
      <View style={s.typeRow}>
        <Text style={s.typeTag}>📢 Annonce sponsorisée</Text>
        <StatusBadge label={st.label} color={st.color} />
      </View>

      {/* Titre + budget */}
      <Text style={s.cardTitle} numberOfLines={1}>
        {ad.titre ?? (ad.format === 'affiche' ? 'Affiche' : 'Annonce')}
      </Text>
      <Text style={s.cardSub}>
        {ad.budgetCredits} crédits LASSI · {formatDuration(ad.durationHours)}
      </Text>

      {/* Métriques vues + contacts */}
      <View style={s.metricsRow}>
        <View style={s.metricBox}>
          <Text style={s.metricCount}>{ad.actualViews.toLocaleString('fr-SN')}</Text>
          <Text style={s.metricLabel}>vues</Text>
        </View>
        <View style={s.metricDivider} />
        <View style={s.metricBox}>
          <Text style={[s.metricCount, { color: colors.success }]}>
            {(ad.contactCount ?? 0).toLocaleString('fr-SN')}
          </Text>
          <Text style={s.metricLabel}>contacts</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={s.progressRow}>
        <Text style={s.progressPct}>{pct}%</Text>
        <Text style={s.progressGoal}>
          objectif {ad.estMin.toLocaleString()}–{ad.estMax.toLocaleString()} vues
        </Text>
      </View>
      <View style={s.progressWrap}>
        <View style={[s.progressBar, { width: `${pct}%` }]} />
      </View>

      {/* Dates */}
      <View style={s.datesRow}>
        <View style={s.datePair}>
          <Text style={s.dateLabel}>Acheté le</Text>
          <Text style={s.dateVal}>{formatDateLong(ad.startedAt)}</Text>
        </View>
        <View style={s.datePair}>
          <Text style={s.dateLabel}>Fin le</Text>
          <Text style={s.dateVal}>{formatDateLong(ad.expiresAt)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Carte Forfait (Offre du Quartier / Boost Recherche) ─────────────────────

function ForfaitCard({
  sub,
  stats,
  statsLoading,
}: {
  sub: ActiveSub;
  stats: VisibilityStats | null;
  statsLoading: boolean;
}) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86_400_000),
  );
  const label = sub.offerType === 'quartier' ? 'Offre du Quartier' : 'Boost Recherche';
  const emoji = sub.offerType === 'quartier' ? '👑' : '🔍';

  return (
    <View style={s.card}>
      {/* Type tag */}
      <View style={s.typeRow}>
        <Text style={s.typeTag}>{emoji} {label}</Text>
        <StatusBadge label="En cours" color={colors.success} />
      </View>

      {/* Plan + méthode */}
      <Text style={s.cardTitle}>Forfait {sub.planLabel}</Text>
      <Text style={s.cardSub}>
        Payé via {payMethodLabel(sub.payMethod)}
      </Text>

      {/* Stats du forfait */}
      {statsLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 14 }} />
      ) : stats ? (
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{stats.viewsThisMonth.toLocaleString('fr-SN')}</Text>
            <Text style={s.statLbl}>vues ce forfait</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: colors.success }]}>
              {stats.visitsSinceSub.toLocaleString('fr-SN')}
            </Text>
            <Text style={s.statLbl}>clics ce forfait</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statVal}>{stats.ordersThisMonth.toLocaleString('fr-SN')}</Text>
            <Text style={s.statLbl}>commandes</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: colors.success }]}>
              {formatPrice(stats.revenueThisMonth)}
            </Text>
            <Text style={s.statLbl}>ventes (F)</Text>
          </View>
        </View>
      ) : null}

      {/* Temps restant */}
      <View style={[s.progressRow, { marginTop: stats ? 0 : 12 }]}>
        <IcoEye />
        <Text style={[s.progressGoal, { marginLeft: 5 }]}>
          {daysLeft > 0
            ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
            : "Expire aujourd'hui"}
        </Text>
      </View>

      {/* Dates */}
      <View style={s.datesRow}>
        <View style={s.datePair}>
          <Text style={s.dateLabel}>Acheté le</Text>
          <Text style={s.dateVal}>{formatDateLong(sub.startedAt)}</Text>
        </View>
        <View style={s.datePair}>
          <Text style={s.dateLabel}>Fin le</Text>
          <Text style={s.dateVal}>{formatDateLong(sub.expiresAt)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function MaCampagneScreen({ onBack }: Props) {
  const shopId = useShopStore(s => s.shopId);

  const [ads, setAds]                   = useState<SponsoredAd[]>([]);
  const [sub, setSub]                   = useState<ActiveSub | null>(null);
  const [stats, setStats]               = useState<VisibilityStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!shopId) return;
    if (!silent) setLoading(true);
    try {
      const [adsData, subData] = await Promise.all([
        getMerchantAds(shopId),
        getActiveSub(shopId).catch(() => null),
      ]);
      setAds(adsData);
      setSub(subData);
      setLastRefresh(new Date());

      // Stats forfait
      if (subData) {
        setStatsLoading(true);
        try {
          const st = await getVisibilityStats(shopId, subData.offerType);
          setStats(st);
        } catch { /* ignore */ }
        finally { setStatsLoading(false); }
      } else {
        setStats(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [shopId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh 60s si une campagne est active
  useEffect(() => {
    const hasActive = ads.some(a => a.status === 'active') || !!sub;
    if (hasActive) {
      intervalRef.current = setInterval(() => { void load(true); }, 60_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [ads, sub, load]);

  const refreshLabel = lastRefresh
    ? `${lastRefresh.getHours().toString().padStart(2, '0')}:${lastRefresh.getMinutes().toString().padStart(2, '0')}`
    : null;

  const HIDE_AFTER_MS = 48 * 60 * 60 * 1000;
  const visibleAds = ads.filter(ad => {
    if (ad.status === 'active') return true;
    return Date.now() - new Date(ad.expiresAt).getTime() < HIDE_AFTER_MS;
  });

  const isEmpty = !loading && visibleAds.length === 0 && !sub;

  return (
    <View style={s.root}>
      <VisibilityHeader title="Ma Campagne" onBack={onBack} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
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
        {/* Barre rafraîchissement */}
        {refreshLabel && (
          <View style={s.refreshRow}>
            <TouchableOpacity style={s.refreshBtn} onPress={() => void load(true)} activeOpacity={0.7}>
              <IcoRefresh />
              <Text style={s.refreshTxt}>Mis à jour à {refreshLabel}</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : isEmpty ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTitle}>Aucune campagne</Text>
            <Text style={s.emptyDesc}>
              Tes annonces sponsorisées et forfaits actifs apparaîtront ici.
            </Text>
          </View>
        ) : (
          <>
            {/* Forfait Offre du Quartier / Boost en premier si actif */}
            {sub && (
              <ForfaitCard
                sub={sub}
                stats={stats}
                statsLoading={statsLoading}
              />
            )}

            {/* Annonces sponsorisées dans l'ordre le plus récent */}
            {visibleAds.map(ad => (
              <AnnonceCard key={ad.id} ad={ad} />
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 16 },

  refreshRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  refreshTxt: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  // Carte commune
  card: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '30',
    borderRadius: radius.lg,
    padding: 16,
    overflow: 'hidden',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeTag: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeTxt: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cardTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    marginBottom: 3,
  },
  cardSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 14,
  },

  // Métriques annonce
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    marginBottom: 14,
    overflow: 'hidden',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  metricCount: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 28,
    lineHeight: 34,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  // Progression
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPct: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  progressGoal: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  progressWrap: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBar: {
    height: 5,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },

  // Stats forfait (grille 2×2)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
  },
  statVal: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
    marginBottom: 2,
  },
  statLbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
  },

  // Dates
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 6,
  },
  datePair: {
    gap: 2,
  },
  dateLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateVal: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 12,
  },

  // État vide
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
