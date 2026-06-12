import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import Avatar from '../Avatar';
import useFavoritesStore from '../../store/favoritesStore';
import VipBadge from '../VipBadge';
import ChampionBadge from '../ChampionBadge';

export interface Shop {
  id: string;
  initial: string;
  name: string;
  logoUrl?: string | null;
  isVip: boolean;
  isChampion?: boolean;
  rating: number;
  status: 'open' | 'closing' | 'closed';
  statusLabel: string;
  specialty: string;
  distance: string;
}

interface Props {
  shop: Shop;
  onPress?: () => void;
}

const StarFill = ({ filled }: { filled: boolean }) => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path
      d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z"
      stroke={filled ? colors.accent : colors.muted}
      fill={filled ? colors.accent : 'none'}
    />
  </Svg>
);

function ShopCard({ shop, onPress }: Props) {
  const isFav = useFavoritesStore(s => s.favorites.includes(shop.id));
  const toggleFav = useFavoritesStore(s => s.toggleFavorite);

  const statusColor =
    shop.status === 'open'
      ? colors.success
      : shop.status === 'closing'
        ? colors.danger
        : colors.muted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Logo boutique — Avatar unique, source de vérité shops.logo_url */}
      <Avatar imageUrl={shop.logoUrl} name={shop.name} size={58} variant="shop" />

      {/* Infos */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.isVip && <VipBadge />}
          {shop.isChampion && <ChampionBadge />}
        </View>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <StarFill filled />
            <Text style={styles.metaTxt}>{shop.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.metaTxt, { color: statusColor }]}>{shop.statusLabel}</Text>
          </View>
          <Text style={styles.metaTxt} numberOfLines={1}>
            {shop.specialty}
          </Text>
        </View>
      </View>

      {/* Distance + favori */}
      <View style={styles.right}>
        <Text style={styles.dist}>{shop.distance}</Text>
        <TouchableOpacity
          style={styles.favBtn}
          onPress={() => toggleFav(shop.id)}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <StarFill filled={isFav} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ShopCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 11,
  },
  info: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
    flexShrink: 1,
  },
  vip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(253, 207, 52, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  vipTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: 7,
    flexShrink: 0,
  },
  dist: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 12.5,
  },
  favBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
