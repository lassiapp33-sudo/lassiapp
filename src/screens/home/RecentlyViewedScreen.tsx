import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import * as rvService from '../../services/recentlyViewed';
import { RecentShop } from '../../services/recentlyViewed';
import MascoHomeBtn from '../../components/MascoHomeBtn';
import logger from '../../utils/logger';
import { IcoBack } from '../../components/icons';
import LoadingSpinner from '../../components/LoadingSpinner';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClockEmpty = () => (
  <Svg
    width={52}
    height={52}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={12} r={10} stroke={colors.border} />
    <Path d="M12 6v6l4 2" stroke={colors.border} />
  </Svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days >= 7) return `Il y a ${Math.floor(days / 7)}sem`;
  if (days > 1) return `Il y a ${days}j`;
  if (days === 1) return 'Hier';
  if (hours > 0) return `Il y a ${hours}h`;
  if (mins > 0) return `Il y a ${mins}min`;
  return "À l'instant";
}

// ─── Carte commerce ───────────────────────────────────────────────────────────

interface CardProps {
  shop: RecentShop;
  onPress: () => void;
}

function RecentCard({ shop, onPress }: CardProps) {
  return (
    <TouchableOpacity style={rc.wrap} onPress={onPress} activeOpacity={0.8}>
      <View style={rc.logo}>
        {shop.logoUrl ? (
          <Image
            source={{ uri: shop.logoUrl }}
            style={rc.logoImg}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text style={rc.logoFallback}>{shop.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>

      <View style={rc.info}>
        <View style={rc.nameRow}>
          <Text style={rc.name} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.isVip && (
            <View style={rc.vipBadge}>
              <Text style={rc.vipTxt}>★ VIP</Text>
            </View>
          )}
        </View>
        <View style={rc.subRow}>
          <Text style={[rc.dot, { color: shop.isOpen ? '#5FD38A' : colors.muted }]}>●</Text>
          <Text style={[rc.status, { color: shop.isOpen ? '#5FD38A' : colors.muted }]}>
            {shop.statusLabel}
          </Text>
          <Text style={rc.sep}>·</Text>
          <Text style={rc.ago}>{timeAgo(shop.viewedAt)}</Text>
        </View>
      </View>

      <Text style={rc.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function RecentlyViewedScreen({ onBack, onShopPress }: Props) {
  const [shops, setShops] = useState<RecentShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const fresh = await rvService.getRecentlyViewed();
      setShops(fresh);
    } catch (err) {
      logger.warn('[RecentlyViewed] erreur fetch:', err);
      // on conserve les données en cache en cas d'erreur réseau
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Affichage instantané depuis le cache local (sans spinner si données présentes)
    rvService
      .getCachedRecentlyViewed()
      .then(cached => {
        if (!cancelled && cached.length > 0) {
          setShops(cached);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Données fraîches depuis Supabase en arrière-plan
    load();

    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <View style={s.root}>
      {/* ── En-tête ── */}
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.title}>Vus récemment</Text>
        {shops.length > 0 ? (
          <View style={s.countBadge}>
            <Text style={s.countTxt}>{shops.length}</Text>
          </View>
        ) : (
          <MascoHomeBtn />
        )}
      </View>

      {/* ── Contenu ── */}
      {loading ? (
        <LoadingSpinner />
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
          {shops.length === 0 ? (
            <View style={s.empty}>
              <IcoClockEmpty />
              <Text style={s.emptyTitle}>Aucun commerce visité</Text>
              <Text style={s.emptySub}>
                Les commerces que vous consultez apparaîtront ici automatiquement.
              </Text>
            </View>
          ) : (
            shops.map(shop => (
              <RecentCard
                key={shop.shopId}
                shop={shop}
                onPress={() => onShopPress(shop.shopId, shop.name)}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles carte ─────────────────────────────────────────────────────────────

const rc = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImg: { width: 52, height: 52 },
  logoFallback: { color: colors.accent, fontFamily: fonts.title, fontSize: 22 },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { color: colors.white, fontFamily: fonts.title, fontSize: 14.5, flex: 1 },
  vipBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(253,207,52,.14)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.3)',
    flexShrink: 0,
  },
  vipTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 9.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { fontSize: 8 },
  status: { fontFamily: fonts.body, fontSize: 11.5 },
  sep: { color: colors.border, fontSize: 12 },
  ago: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5 },
  arrow: { color: '#5a5c80', fontSize: 22, lineHeight: 24, flexShrink: 0 },
});

// ─── Styles écran ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
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
    flexShrink: 0,
  },
  title: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(253,207,52,.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  countTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 12 },
  scroll: { flex: 1 },
  content: { paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32, gap: 14 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16, textAlign: 'center' },
  emptySub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
