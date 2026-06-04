import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import useFavoritesStore from '../../store/favoritesStore';
import * as shopsService from '../../services/shops';
import { Shop } from '../../services/shops';
import { computeStatus } from '../../services/hours';
import type { WeekHours } from '../../services/hours';
import { useRealtimeShops } from '../../hooks/useRealtimeShops';
import Avatar from '../../components/Avatar';
import { useT } from '../../i18n';
import logger from '../../utils/logger';
import { IcoBack } from '../../components/icons';

const IcoHeart = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill={colors.accent}
    stroke={colors.accent}
    strokeWidth={1.2}
  >
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z" />
  </Svg>
);

const IcoStar = () => (
  <Svg
    width={11}
    height={11}
    viewBox="0 0 24 24"
    fill={colors.accent}
    stroke={colors.accent}
    strokeWidth={1}
  >
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" />
  </Svg>
);

type FavFilter = 'all' | 'tangana' | 'store' | 'hair';

// Dériver l'étiquette de catégorie depuis le champ category de Supabase
function catLabel(category: string): string {
  const MAP: Record<string, string> = {
    tangana: 'Tangana / Ndéki / Soupe',
    food: 'Restos & Boissons',
    hair: 'Coiffeurs & Salons',
    stores: 'Commerçants du quartier',
    sport: 'Fitness',
    bakery: 'Boulangeries',
    fruiterie: 'Fruiterie',
  };
  return MAP[category] ?? category;
}

// Map Supabase category → filtre FavFilter
function toFavFilter(category: string): FavFilter {
  if (category === 'tangana') return 'tangana';
  if (category === 'hair') return 'hair';
  if (category === 'stores') return 'store';
  return 'all';
}

function FavCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const t = useT();
  const { isOpen } = computeStatus(
    shop.openingHours as WeekHours | null,
    shop.isManuallyClose ?? false,
  );
  const statusColor = isOpen ? colors.success : colors.danger;
  const statusLabel = isOpen ? t.common.open : t.common.closed;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Logo boutique — Avatar unique, source de vérité shops.logo_url */}
      <Avatar imageUrl={shop.logoUrl} name={shop.name} size={56} variant="shop" />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipTxt}>VIP</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.ratingWrap}>
            <IcoStar />
            <Text style={styles.metaTxt}>{shop.rating.toFixed(1)}</Text>
          </View>
          <Text style={[styles.metaTxt, { color: statusColor }]}>● {statusLabel}</Text>
        </View>

        <Text style={styles.catLbl}>{catLabel(shop.category)}</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.heartBtn}>
          <IcoHeart />
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function FavoritesScreen({ onBack, onShopPress }: Props) {
  const t = useT();

  const FILTERS: { id: FavFilter; label: string }[] = [
    { id: 'all', label: t.favorites.all },
    { id: 'tangana', label: t.favorites.tangana },
    { id: 'store', label: t.favorites.stores },
    { id: 'hair', label: t.favorites.hair },
  ];

  const [filter, setFilter] = useState<FavFilter>('all');
  const [favShops, setFavShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState(false);

  const favorites = useFavoritesStore(s => s.favorites);
  const loadFavorites = useFavoritesStore(s => s.loadFavorites);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Charger les boutiques favorisées depuis Supabase
  const loadFavShops = React.useCallback(() => {
    if (favorites.length === 0) {
      setFavShops([]);
      return;
    }
    setShopsLoading(true);
    setShopsError(false);
    Promise.all(favorites.map(id => shopsService.getShopById(id)))
      .then(results => setFavShops(results.filter(Boolean) as Shop[]))
      .catch(err => {
        logger.warn('[FavoritesScreen] load shops:', err);
        setShopsError(true);
      })
      .finally(() => setShopsLoading(false));
  }, [favorites]);

  useEffect(() => {
    loadFavShops();
  }, [loadFavShops]);

  // Mise à jour temps réel quand un commerce change ses horaires ou son statut
  useRealtimeShops(updated => {
    setFavShops(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  });

  const visible = useMemo(
    () => (filter === 'all' ? favShops : favShops.filter(s => toFavFilter(s.category) === filter)),
    [favShops, filter],
  );

  return (
    <LassiScreen
      header={
        <>
          <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
              <IcoBack />
            </TouchableOpacity>
            <View>
              <Text style={styles.headTitle}>{t.favorites.title}</Text>
              <Text style={styles.headSub}>
                {favShops.length}{' '}
                {favShops.length !== 1 ? t.profile.favoritesMany : t.profile.favoriteOne}
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersStrip}
            contentContainerStyle={styles.filtersWrap}
          >
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, filter === f.id && styles.chipOn]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipTxt, filter === f.id && styles.chipTxtOn]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      }
    >
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      >
        {shopsLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : shopsError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>
              Connexion impossible, vérifie ta connexion et réessaie.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadFavShops} activeOpacity={0.8}>
              <Text style={styles.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {visible.map(shop => (
              <FavCard key={shop.id} shop={shop} onPress={() => onShopPress(shop.id, shop.name)} />
            ))}

            {visible.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTxt}>{t.favorites.empty}</Text>
                <Text style={styles.emptySub}>{t.favorites.emptySub}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 22 },
  headSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  filtersStrip: { flexGrow: 0, flexShrink: 0 },
  filtersWrap: { paddingHorizontal: 18, paddingVertical: 16, gap: 8, flexDirection: 'row' },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  chipTxtOn: { color: colors.bg },

  card: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { color: colors.white, fontFamily: fonts.title, fontSize: 14.5, flexShrink: 1 },
  vipBadge: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vipTxt: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 8 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  catLbl: { color: '#5a5c80', fontFamily: fonts.body, fontSize: 10, marginTop: 3 },

  right: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(253,207,52,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loader: { paddingVertical: 48, alignItems: 'center' },
  empty: { paddingVertical: 40, alignItems: 'center', paddingHorizontal: 24 },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptySub: {
    color: '#3a3c5c',
    fontFamily: fonts.body,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 6,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 13 },
});
