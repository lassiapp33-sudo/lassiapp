import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { ProductPromoInfo } from '../../types/promotions';

export interface Product {
  id:        string;
  emoji:     string;
  photoUrl?: string;
  name:      string;
  desc:      string;
  price:     number;
  category:  string;
  stock?:    'in' | 'out';
}

const IcoPlus = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.5} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.bg} />
  </Svg>
);

interface Props {
  product:   Product;
  qty:       number;
  onAdd:     () => void;
  onRemove:  () => void;
  onPress?:  () => void;
  promoInfo?: ProductPromoInfo;
}

export default function ProductTile({ product, qty, onAdd, onRemove, onPress, promoInfo }: Props) {
  const isOut = product.stock === 'out';

  return (
    <TouchableOpacity
      style={[styles.tile, isOut && styles.tileOut]}
      onPress={isOut ? undefined : onPress}
      activeOpacity={isOut ? 1 : 0.88}
      disabled={isOut}
    >
      {/* Zone visuelle photo, emoji, ou vide */}
      <View style={styles.imgZone}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={styles.photo} />
        ) : product.emoji ? (
          <Text style={styles.emoji}>{product.emoji}</Text>
        ) : null}

        {/* Badge Épuisé */}
        {isOut && (
          <View style={styles.epuiseBadge}>
            <Text style={styles.epuiseTxt}>Épuisé</Text>
          </View>
        )}

        {/* Badge Promo (masqué si épuisé) */}
        {!isOut && promoInfo && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeTxt}>{promoInfo.badge}</Text>
          </View>
        )}

        {/* Contrôles panier — masqués si indisponible */}
        {!isOut && (qty === 0 ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={e => { e.stopPropagation?.(); onAdd(); }}
            activeOpacity={0.8}
          >
            <IcoPlus />
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
        ))}
      </View>

      {/* Infos produit */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.desc} numberOfLines={1}>{product.desc}</Text>
        {/* Prix barré + prix promo OU prix normal */}
        {promoInfo?.promoPrice !== undefined ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceOld}>{product.price.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.pricePromo}>{promoInfo.promoPrice.toLocaleString('fr-FR')} F</Text>
          </View>
        ) : (
          <Text style={[styles.price, isOut && styles.priceOut]}>
            {product.price.toLocaleString('fr-FR')} F
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  imgZone: {
    height: 96,
    backgroundColor: '#1a1b38',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: { fontSize: 38 },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  addBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyBar: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    overflow: 'hidden',
    height: 30,
  },
  qtyBtn: {
    width: 28,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyOp: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 17,
    lineHeight: 22,
  },
  qtyNum: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 13,
    minWidth: 18,
    textAlign: 'center',
  },

  body: {
    padding: 10,
    paddingBottom: 13,
    paddingHorizontal: 12,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
    lineHeight: 18,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 3,
    lineHeight: 15,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
    marginTop: 8,
  },

  // Badge promo
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  promoBadgeTxt: {
    color:      colors.bg,
    fontFamily: fonts.titleXL,
    fontSize:   9,
    letterSpacing: 0.3,
  },

  // Prix barré
  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  priceOld: {
    color:            colors.muted,
    fontFamily:       fonts.body,
    fontSize:         11,
    textDecorationLine: 'line-through',
  },
  pricePromo: {
    color:      colors.accent,
    fontFamily: fonts.titleXL,
    fontSize:   14,
  },

  // État indisponible
  tileOut: {
    opacity: 0.58,
  },
  epuiseBadge: {
    position:        'absolute',
    top:             8,
    left:            8,
    backgroundColor: colors.danger,
    borderRadius:    6,
    paddingVertical:  3,
    paddingHorizontal: 7,
  },
  epuiseTxt: {
    color:      '#fff',
    fontFamily: fonts.titleXL,
    fontSize:   9,
    letterSpacing: 0.3,
  },
  priceOut: {
    color: colors.muted,
  },
});
