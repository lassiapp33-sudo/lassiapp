import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { StoreProduct } from '../../types/store';

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface Props {
  products: StoreProduct[];
  /** IDs des produits choisis (ignoré si allProducts === true). */
  selectedIds: string[];
  /** Mettre en avant toute la vitrine plutôt que des produits précis. */
  allProducts: boolean;
  onToggleProduct: (id: string) => void;
  onToggleAllProducts: () => void;
}

export default function ProductPicker({
  products,
  selectedIds,
  allProducts,
  onToggleProduct,
  onToggleAllProducts,
}: Props) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTxt}>
          Ajoute un produit dans ta vitrine pour pouvoir le mettre en avant.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Toute la vitrine */}
      <TouchableOpacity
        style={[styles.card, allProducts && styles.cardSel]}
        onPress={onToggleAllProducts}
        activeOpacity={0.82}
      >
        <View style={[styles.checkbox, allProducts && styles.checkboxSel]}>
          {allProducts && <IcoCheck />}
        </View>
        <View style={styles.imgBox}>
          <Text style={styles.emoji}>🏪</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            Toute ma vitrine
          </Text>
          <Text style={styles.allDesc}>
            {products.length} produit{products.length > 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Produits individuels (un ou plusieurs) */}
      {!allProducts &&
        products.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, selected && styles.cardSel]}
              onPress={() => onToggleProduct(p.id)}
              activeOpacity={0.82}
            >
              {/* Case à cocher */}
              <View style={[styles.checkbox, selected && styles.checkboxSel]}>
                {selected && <IcoCheck />}
              </View>

              {/* Image / emoji */}
              <View style={styles.imgBox}>
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.img} />
                ) : (
                  <Text style={styles.emoji}>{p.emoji || '🛍️'}</Text>
                )}
              </View>

              {/* Nom + prix */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.price}>{formatPrice(p.price)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 12,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
  },
  cardSel: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.05)',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSel: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },

  imgBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  img: {
    width: 44,
    height: 44,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  emoji: { fontSize: 22 },

  info: { flex: 1 },
  name: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 13,
    marginTop: 2,
  },
  allDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 2,
  },

  empty: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 16,
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
