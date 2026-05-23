import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import useFavoritesStore from '../../store/favoritesStore';

export type PlaceStatus = 'open' | 'closing' | 'closed';
export type PlaceCategory = 'tangana' | 'store' | 'hair' | 'food' | 'sport';

export interface NearbyPlace {
  id:         string;
  name:       string;
  category:   PlaceCategory;
  rating:     number;
  distance:   string;
  status:     PlaceStatus;
  statusLabel:string;
  isVip:      boolean;
  isFav:      boolean;
}

interface Props {
  place:    NearbyPlace;
  onPress?: () => void;
}

// Miniatures d'icônes pour les thumbs des commerces
const ThumbIcon = ({ category }: { category: PlaceCategory }) => {
  const s = colors.accent;
  switch (category) {
    case 'tangana':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke={s} />
          <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" stroke={s} />
          <Path d="M6 2v2M10 2v2M14 2v2" stroke={s} />
        </Svg>
      );
    case 'store':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 9l1-5h16l1 5" stroke={s} /><Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={s} />
          <Path d="M3 9h18" stroke={s} /><Path d="M9 22V12h6v10" stroke={s} />
        </Svg>
      );
    case 'hair':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 2l1 6M18 2l-1 6" stroke={s} />
          <Circle cx={12} cy={6} r={3} stroke={s} />
          <Path d="M6 8c-2 0-3 2-3 4s1 9 1 9M18 8c2 0 3 2 3 4s-1 9-1 9" stroke={s} />
        </Svg>
      );
    default:
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={s} />
          <Circle cx={12} cy={10} r={3} stroke={s} />
        </Svg>
      );
  }
};

const IconStarFill = ({ filled }: { filled: boolean }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path
      d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={filled ? colors.accent : colors.muted}
      fill={filled ? colors.accent : 'none'}
    />
  </Svg>
);

const IconStarSmall = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={colors.accent} fill={colors.accent} />
  </Svg>
);

const VipBadge = () => (
  <View style={styles.vip}>
    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}>
      <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" stroke={colors.accent} fill={colors.accent} />
    </Svg>
    <Text style={styles.vipTxt}>VIP</Text>
  </View>
);

export default function NearbyCard({ place, onPress }: Props) {
  const isFav        = useFavoritesStore(s => s.favorites.includes(place.id));
  const toggleFav    = useFavoritesStore(s => s.toggleFavorite);

  const statusColor =
    place.status === 'open'    ? colors.success :
    place.status === 'closing' ? colors.danger  : colors.muted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Thumb icône catégorie */}
      <View style={styles.thumb}>
        <ThumbIcon category={place.category} />
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          {place.isVip && <VipBadge />}
        </View>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <IconStarSmall />
            <Text style={styles.metaTxt}>{place.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.metaTxt, { color: statusColor }]}>{place.statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Distance + favori */}
      <View style={styles.right}>
        <Text style={styles.dist}>{place.distance}</Text>
        <TouchableOpacity
          style={styles.starBtn}
          onPress={() => toggleFav(place.id)}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <IconStarFill filled={isFav} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

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
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info:    { flex: 1, minWidth: 0 },
  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
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
    fontSize: 8.5,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
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
    gap: 6,
    flexShrink: 0,
  },
  dist: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  starBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
