import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import useFavoritesStore from '../../store/favoritesStore';

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoHeart = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24"
    fill={colors.accent} stroke={colors.accent} strokeWidth={1.2}>
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z" />
  </Svg>
);

const IcoStar = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24"
    fill={colors.accent} stroke={colors.accent} strokeWidth={1}>
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" />
  </Svg>
);

// ─── Types et données mock ────────────────────────────────────────────────────

type FavFilter = 'all' | 'tangana' | 'store' | 'hair';

interface FavShop {
  id:        string;
  initial:   string;
  name:      string;
  isVip:     boolean;
  rating:    number;
  isOpen:    boolean;
  closingAt?: string;   // ex: "20h" si ferme bientôt
  category:  FavFilter;
  catLabel:  string;
  distance:  string;
}

// Catalogue partagé — les IDs correspondent aux IDs des NearbyCard et ShopScreen
const SHOP_CATALOG: FavShop[] = [
  {
    id: '1', initial: 'M',
    name: 'Tangana Chez Modou',
    isVip: true, rating: 4.8, isOpen: true,
    category: 'tangana', catLabel: 'Tangana / Ndéki',
    distance: '40 m',
  },
  {
    id: '2', initial: 'A',
    name: 'Boutique Aïda Gaye',
    isVip: false, rating: 4.6, isOpen: true,
    category: 'store', catLabel: 'Commerçants du quartier',
    distance: '85 m',
  },
  {
    id: '3', initial: 'K',
    name: 'Salon Khadija Beauté',
    isVip: false, rating: 4.9, isOpen: false, closingAt: '20h',
    category: 'hair', catLabel: 'Coiffeurs & Salons',
    distance: '120 m',
  },
  {
    id: 'shop_diallo', initial: 'D',
    name: 'Tangana Diallo & Frères',
    isVip: true, rating: 4.9, isOpen: true,
    category: 'tangana', catLabel: 'Tangana / Ndéki',
    distance: '220 m',
  },
];

const FILTERS: Array<{ id: FavFilter; label: string }> = [
  { id: 'all',     label: 'Tous' },
  { id: 'tangana', label: 'Tangana' },
  { id: 'store',   label: 'Commerçants' },
  { id: 'hair',    label: 'Coiffeurs' },
];

// ─── Carte favori ─────────────────────────────────────────────────────────────

function FavCard({ shop, onPress }: { shop: FavShop; onPress: () => void }) {
  const statusColor = shop.isOpen
    ? (shop.closingAt ? colors.danger : colors.success)
    : colors.danger;

  const statusLabel = shop.isOpen
    ? (shop.closingAt ? `Ferme à ${shop.closingAt}` : 'Ouvert')
    : 'Fermé';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar initial */}
      <View style={styles.thumb}>
        <Text style={styles.thumbTxt}>{shop.initial}</Text>
      </View>

      {/* Infos principales */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
          {shop.isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipTxt}>VIP</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.ratingWrap}>
            <IcoStar />
            <Text style={styles.metaTxt}>{shop.rating}</Text>
          </View>
          <Text style={[styles.metaTxt, { color: statusColor }]}>
            ● {statusLabel}
          </Text>
        </View>

        <Text style={styles.catLbl}>{shop.catLabel}</Text>
      </View>

      {/* Distance + cœur */}
      <View style={styles.right}>
        <Text style={styles.dist}>{shop.distance}</Text>
        <View style={styles.heartBtn}>
          <IcoHeart />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props {
  onBack:      () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

export default function FavoritesScreen({ onBack, onShopPress }: Props) {
  const [filter, setFilter] = useState<FavFilter>('all');
  const favorites = useFavoritesStore(s => s.favorites);

  // Filtre le catalogue aux seuls commerces ajoutés en favori
  const favShops = SHOP_CATALOG.filter(s => favorites.includes(s.id));
  const visible  = filter === 'all'
    ? favShops
    : favShops.filter(f => f.category === filter);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      >
        {/* En-tête */}
        <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
            <IcoBack />
          </TouchableOpacity>
          <View>
            <Text style={styles.headTitle}>Mes favoris</Text>
            <Text style={styles.headSub}>{favShops.length} commerce{favShops.length !== 1 ? 's' : ''} enregistré{favShops.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Filtres — style obligatoire pour ne pas consommer tout l'espace vertical */}
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
              <Text style={[styles.chipTxt, filter === f.id && styles.chipTxtOn]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste */}
        {visible.map(shop => (
          <FavCard
            key={shop.id}
            shop={shop}
            onPress={() => onShopPress(shop.id, shop.name)}
          />
        ))}

        {visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Aucun favori dans cette catégorie</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
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
  headTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 22,
  },
  headSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  // Filtres
  filtersStrip: { flexGrow: 0, flexShrink: 0 },
  filtersWrap: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
    flexDirection: 'row',
  },
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
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  chipTxtOn: { color: colors.bg },

  // Carte favori
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

  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2a2c52',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
  },

  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
    flexShrink: 1,
  },
  vipBadge: {
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vipTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 8,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 4,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  catLbl: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 3,
  },

  right: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  dist: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(253,207,52,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
