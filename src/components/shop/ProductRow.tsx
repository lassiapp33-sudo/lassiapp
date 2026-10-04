import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../../theme';
import { ProductPromoInfo } from '../../types/promotions';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient, calculerPrixClientVip } from '../../config/payment';
import { calcPromoClientPrice } from '../../services/promotions';
import { Product } from './ProductTile';

interface Props {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onPress?: () => void;
  promoInfo?: ProductPromoInfo;
  highlighted?: boolean;
  isVip?: boolean;
}

const IMG = 90;

export default function ProductRow({
  product,
  qty,
  onAdd,
  onRemove,
  onPress,
  promoInfo,
  highlighted,
  isVip = false,
}: Props) {
  const isOut = product.stock === 'out';
  const calcPrix = isVip ? calculerPrixClientVip : calculerPrixClient;
  const prixPromo = calcPromoClientPrice(product.price, promoInfo, isVip);

  return (
    <TouchableOpacity
      style={[styles.row, isOut && styles.rowOut, highlighted && styles.rowHL]}
      onPress={isOut ? undefined : onPress}
      activeOpacity={isOut ? 1 : 0.85}
      disabled={isOut}
    >
      {/* Texte gauche */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {!!product.desc && (
          <Text style={styles.desc} numberOfLines={2}>{product.desc}</Text>
        )}
        {prixPromo !== null ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceOld}>{formatPrice(calcPrix(product.price))}</Text>
            <Text style={styles.pricePromo}>{formatPrice(prixPromo)}</Text>
          </View>
        ) : (
          <Text style={[styles.price, isOut && styles.priceMuted]}>
            {formatPrice(calcPrix(product.price))}
          </Text>
        )}
        {isOut && <Text style={styles.epuise}>Épuisé</Text>}
      </View>

      {/* Image droite + contrôles panier */}
      <View style={styles.imgZone}>
        {product.photoUrl ? (
          <Image
            source={{ uri: product.photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : !!product.emoji ? (
          <Text style={styles.emoji}>{product.emoji}</Text>
        ) : null}

        {!isOut && promoInfo && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{promoInfo.badge}</Text>
          </View>
        )}

        {!isOut && (
          qty === 0 ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={e => { e.stopPropagation?.(); onAdd(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.addTxt}>+</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyBar}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={e => { e.stopPropagation?.(); onRemove(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.qtyOp}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={e => { e.stopPropagation?.(); onAdd(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.qtyOp}>+</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 14,
    minHeight: IMG + 28,
  },
  rowOut: { opacity: 0.5 },
  rowHL: { backgroundColor: `${colors.accent}18` },

  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14.5,
    lineHeight: 20,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
    marginTop: 4,
  },
  priceMuted: { color: colors.muted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  priceOld: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  pricePromo: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  epuise: {
    color: colors.danger,
    fontFamily: fonts.titleXL,
    fontSize: 10,
    marginTop: 2,
  },

  imgZone: {
    width: IMG,
    height: IMG,
    backgroundColor: '#1a1b38',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  emoji: { fontSize: 32 },

  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.accent,
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 8,
  },

  addBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 20,
    lineHeight: 24,
    marginTop: -1,
  },

  qtyBar: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 9,
    overflow: 'hidden',
    height: 28,
  },
  qtyBtn: {
    width: 26,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyOp: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
    lineHeight: 20,
  },
  qtyNum: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 12,
    minWidth: 16,
    textAlign: 'center',
  },
});
