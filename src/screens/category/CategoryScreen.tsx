import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import TopBar from '../../components/category/TopBar';
import CatNavBar from '../../components/category/CatNavBar';
import { CatId, getCatConfig } from '../../config/categories';
import { supabase } from '../../lib/supabase';
import SubCatTabs, { SubCat } from '../../components/category/SubCatTabs';
import VipPodium, { VipEntry } from '../../components/category/VipPodium';
import FilterBar, { FilterId } from '../../components/category/FilterBar';
import ShopCard, { Shop as ShopCard_Shop } from '../../components/category/ShopCard';
import BottomNav, { NavTab, NAV_HEIGHT } from '../../components/home/BottomNav';
import { colors, fonts } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import * as shopsService from '../../services/shops';
import { Shop, calcDistanceMeters, calcDistance, getUserLocation } from '../../services/shops';
import { computeStatus, WeekHours } from '../../services/hours';
import { useT } from '../../i18n';

/** Construit les SubCat[] — imageUri vient directement de categories.ts (source unique). */
function buildSubcats(catId: CatId): SubCat[] {
  const cfg = getCatConfig(catId);
  if (!cfg) return [];
  return cfg.subcats.map(sub => ({
    id: sub.id,
    label: sub.imageUri ? sub.label : `${sub.emoji} ${sub.label}`,
    imageUri: sub.imageUri,
  }));
}

/** Retourne title / subLabel / subcats pour l'écran — sans duplication. */
function getCatMeta(catId: CatId) {
  const cfg = getCatConfig(catId)!;
  return {
    title: cfg.label,
    subLabel: cfg.subLabel,
    subcats: buildSubcats(catId),
  };
}

function toShopCard(s: Shop, userLoc?: { lat: number; lng: number } | null): ShopCard_Shop {
  let distance = '—';
  if (userLoc && s.latitude != null && s.longitude != null) {
    distance = calcDistance(userLoc.lat, userLoc.lng, s.latitude, s.longitude);
  }
  const realStatus = computeStatus(s.openingHours as WeekHours | null, s.isManuallyClose);
  return {
    id: s.id,
    initial: s.name.charAt(0).toUpperCase(),
    name: s.name,
    logoUrl: s.logoUrl ?? null,
    isVip: s.isVip,
    rating: s.rating,
    status: realStatus.isOpen ? 'open' : 'closed',
    statusLabel: realStatus.isOpen ? 'Ouvert' : 'Fermé',
    specialty: s.subtitle,
    distance,
  };
}

function applyFilter(
  shops: Shop[],
  filter: FilterId,
  userLoc: { lat: number; lng: number } | null,
): Shop[] {
  switch (filter) {
    case 'top':
      return [...shops].sort((a, b) => b.rating - a.rating);
    case 'open':
      return [...shops]
        .filter(s => computeStatus(s.openingHours as WeekHours | null, s.isManuallyClose).isOpen)
        .sort((a, b) => b.rating - a.rating);
    case 'near':
    default: {
      if (!userLoc) return shops;
      return [...shops].sort((a, b) => {
        const dA =
          a.latitude != null && a.longitude != null
            ? calcDistanceMeters(userLoc.lat, userLoc.lng, a.latitude, a.longitude)
            : Infinity;
        const dB =
          b.latitude != null && b.longitude != null
            ? calcDistanceMeters(userLoc.lat, userLoc.lng, b.latitude, b.longitude)
            : Infinity;
        return dA - dB;
      });
    }
  }
}

// ── Écran ─────────────────────────────────────────────────────────────────────

interface Props {
  initialCatId: CatId;
  initialSubCatId?: string;
  onBack: () => void;
  onShopPress?: (shopId: string, shopName: string) => void;
  onCatStateChange?: (catId: CatId, subCatId: string) => void;
  onSearch?: () => void;
  onFavorites?: () => void;
  onMessages?: () => void;
  onProfile?: () => void;
  onVoice?: () => void;
}

export default function CategoryScreen({
  initialCatId,
  initialSubCatId,
  onBack,
  onShopPress,
  onCatStateChange,
  onSearch,
  onFavorites,
  onMessages,
  onProfile,
  onVoice,
}: Props) {
  const t = useT();

  const [catId, setCatId] = useState<CatId>(initialCatId);
  const [subCat, setSubCat] = useState<string>(initialSubCatId ?? getCatMeta(initialCatId).subcats[0].id);
  const [filter, setFilter] = useState<FilterId>('near');
  const [navTab, setNavTab] = useState<NavTab>('home');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const meta = getCatMeta(catId);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadShops = useCallback(async (cat: CatId) => {
    setLoading(true);
    try {
      const data = await shopsService.getShopsByCategory(cat);
      setShops(data);
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getUserLocation().then(setUserLoc);
    loadShops(catId);

    // Realtime : mise à jour automatique quand un prestataire s'inscrit ou modifie sa fiche
    const ch = supabase
      .channel(`shops-cat-${catId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shops', filter: `category=eq.${catId}` },
        () => loadShops(catId),
      )
      .subscribe();

    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [catId, loadShops]);

  const handleCatChange = useCallback((id: CatId) => {
    const firstSub = getCatMeta(id).subcats[0].id;
    setCatId(id);
    setSubCat(firstSub);
    onCatStateChange?.(id, firstSub);
  }, [onCatStateChange]);

  const handleSubCatChange = useCallback((id: string) => {
    setSubCat(id);
    onCatStateChange?.(catId, id);
  }, [catId, onCatStateChange]);

  const handleNavPress = (t: NavTab) => {
    setNavTab(t);
    if (t === 'favorites') onFavorites?.();
    if (t === 'voice') onVoice?.();
    if (t === 'messages') onMessages?.();
    if (t === 'profile') onProfile?.();
  };

  const activeSubCatLabel = useMemo(() => {
    if (meta.subcats.length <= 1) return meta.subLabel;
    const cfg = getCatConfig(catId);
    const sub = cfg?.subcats.find(s => s.id === subCat);
    return sub?.label ?? meta.subLabel;
  }, [catId, subCat, meta]);

  // Top 3 VIP — mémorisé : filter+sort coûteux sur grande liste
  const vipShops = useMemo(
    () =>
      shops
        .filter(s => s.isVip)
        .sort((a, b) => {
          if (a.vipRank !== null && b.vipRank !== null) return a.vipRank - b.vipRank;
          if (a.vipRank !== null) return -1;
          if (b.vipRank !== null) return 1;
          return b.rating - a.rating;
        })
        .slice(0, 3),
    [shops],
  );

  const vipEntries: VipEntry[] = useMemo(
    () =>
      ([1, 2, 3] as const).map(rank => {
        const s = vipShops[rank - 1];
        if (s) {
          return {
            rank,
            id: s.id,
            initial: s.name.charAt(0).toUpperCase(),
            name: s.name,
            zone: s.zone,
            rating: s.rating,
            logoUrl: s.logoUrl,
            isPlaceholder: false,
          };
        }
        return {
          rank,
          id: '',
          initial: ['A', 'B', 'C'][rank - 1],
          name: t.category.availableSlot,
          zone: '',
          rating: 0,
          logoUrl: null,
          isPlaceholder: true,
        };
      }),
    [vipShops, t],
  );

  // Filtrer + trier — mémorisé : applyFilter('near') = O(n log n) × calcDistanceMeters
  const bySubCat = useMemo(
    () => (meta.subcats.length <= 1 ? shops : shops.filter(s => s.subcategories.includes(subCat))),
    [shops, subCat, meta.subcats.length],
  );

  const filteredShops = useMemo(
    () => applyFilter(bySubCat, filter, userLoc),
    [bySubCat, filter, userLoc],
  );

  const shopCards = useMemo(
    () => filteredShops.map(s => toShopCard(s, userLoc)),
    [filteredShops, userLoc],
  );

  const handleShopPress = useCallback(
    (id: string, name: string) => {
      onShopPress?.(id, name);
    },
    [onShopPress],
  );

  const handleVipPress = useCallback(
    (entry: VipEntry) => {
      if (!entry.isPlaceholder && entry.id) handleShopPress(entry.id, entry.name);
    },
    [handleShopPress],
  );

  const listHeader = useMemo(
    () => (
      <>
        <CatNavBar active={catId} onSelect={handleCatChange} />
        {meta.subcats.length > 1 && (
          <SubCatTabs tabs={meta.subcats} active={subCat} onChange={handleSubCatChange} />
        )}
        <VipPodium
          entries={vipEntries}
          subLabel={activeSubCatLabel}
          renewIn="7j"
          onPress={handleVipPress}
        />
        <FilterBar active={filter} onChange={setFilter} />
        <View style={styles.px}>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>
              {t.category.allShopsPrefix} {meta.subLabel}
              {t.category.allShopsSuffix}
            </Text>
            <Text style={styles.listCount}>
              {filteredShops.length}{' '}
              {filteredShops.length > 1 ? t.category.registeredPlural : t.category.registered}
            </Text>
          </View>
        </View>
      </>
    ),
    [
      catId,
      meta,
      subCat,
      activeSubCatLabel,
      vipEntries,
      filter,
      t,
      filteredShops.length,
      handleCatChange,
      handleSubCatChange,
      handleVipPress,
      setFilter,
    ],
  );

  return (
    <LassiScreen
      header={<TopBar title={meta.title} onBack={onBack} onSearch={onSearch} />}
      footer={<BottomNav active={navTab} onPress={handleNavPress} />}
    >
      <FlatList
        data={loading ? [] : shopCards}
        keyExtractor={item => item.id}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: NAV_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: shop }) => (
          <View style={styles.px}>
            <ShopCard shop={shop} onPress={() => handleShopPress(shop.id, shop.name)} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.px}>
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.emptyTxt}>{t.category.noShops}</Text>
              )}
            </View>
          </View>
        }
      />
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 20 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  listCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
