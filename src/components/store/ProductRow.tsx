import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { StoreProduct, StockStatus } from '../../types/store';
import { formatPrice } from '../../utils/format';

// ─── Icône crayon ────────────────────────────────────────────────────────────

const IcoPencil = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={colors.accent} />
    <Path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" stroke={colors.accent} />
  </Svg>
);

// ─── Badge stock ──────────────────────────────────────────────────────────────

const STOCK_CONFIG: Record<StockStatus, { label: string; bg: string; color: string }> = {
  in:  { label: 'EN STOCK', bg: 'rgba(95,211,138,.13)',  color: colors.success },
  out: { label: 'ÉPUISÉ',   bg: 'rgba(224,122,122,.13)', color: colors.danger  },
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  product:       StoreProduct;
  onEdit:        () => void;
  onToggleStock: () => void;
  promoInfo?:    { badge: string };
}

export default function ProductRow({ product, onEdit, onToggleStock, promoInfo }: Props) {
  const sc = STOCK_CONFIG[product.stock];

  return (
    <View style={styles.card}>
      {/* Zone image : vraie photo, emoji, ou zone vide */}
      <View style={styles.imgZone}>
        {product.photoUrl ? (
          <Image
            source={{ uri: product.photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
          />
        ) : product.emoji ? (
          <Text style={styles.emoji}>{product.emoji}</Text>
        ) : null}
      </View>

      {/* Infos produit */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.desc} numberOfLines={1}>{product.desc}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {promoInfo && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeTxt}>{promoInfo.badge}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions : badge stock + bouton éditer */}
      <View style={styles.actions}>
        {/* Badge stock — tappable pour basculer */}
        <TouchableOpacity
          style={[styles.stockBadge, { backgroundColor: sc.bg }]}
          onPress={onToggleStock}
          activeOpacity={0.75}
          hitSlop={6}
        >
          <Text style={[styles.stockTxt, { color: sc.color }]}>{sc.label}</Text>
        </TouchableOpacity>

        {/* Bouton éditer */}
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <IcoPencil />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  imgZone: {
    width: 56,
    height: 56,
    borderRadius: 13,
    backgroundColor: '#222447',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 13,
  },
  emoji: { fontSize: 26 },

  info: { flex: 1, minWidth: 0 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 13.5,
  },
  promoBadge: {
    backgroundColor: 'rgba(253,207,52,.18)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  promoBadgeTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },

  actions: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  stockBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  stockTxt: {
    fontFamily: fonts.titleXL,
    fontSize: 9,
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(253,207,52,.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
