import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export interface Product {
  id:       string;
  emoji:    string;
  name:     string;
  desc:     string;
  price:    number;
  category: 'petitdej' | 'boissons' | 'plats';
}

const IcoPlus = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.5} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.bg} />
  </Svg>
);

interface Props {
  product:  Product;
  qty:      number;
  onAdd:    () => void;
  onRemove: () => void;
  onPress?: () => void;   // ouverture du détail produit (futur)
}

export default function ProductTile({ product, qty, onAdd, onRemove, onPress }: Props) {
  return (
    // Toute la tuile est tappable pour ouvrir le détail produit
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.88}
      disabled={!onPress}
    >
      {/* Zone visuelle emoji / future photo produit */}
      <View style={styles.imgZone}>
        <Text style={styles.emoji}>{product.emoji}</Text>

        {qty === 0 ? (
          // Premier ajout : bouton + simple
          <TouchableOpacity
            style={styles.addBtn}
            onPress={e => { e.stopPropagation?.(); onAdd(); }}
            activeOpacity={0.8}
          >
            <IcoPlus />
          </TouchableOpacity>
        ) : (
          // Déjà dans le panier : compteur − N +
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
        )}
      </View>

      {/* Infos produit */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.desc} numberOfLines={1}>{product.desc}</Text>
        <Text style={styles.price}>{product.price.toLocaleString('fr-FR')} F</Text>
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
});
