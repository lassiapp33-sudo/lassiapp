import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { StoreProduct } from '../../types/store';

const IC = '#FDCF34';
const IF = '#FDCF3440';

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3}>
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IcoStore = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path d="M3 9l1-5h16l1 5" stroke={IC} strokeWidth={1.5} fill={IF} strokeLinejoin="round"/>
    <Rect x="3" y="9" width="18" height="12" rx="1" stroke={IC} strokeWidth={1.5} fill={IF}/>
    <Rect x="9" y="14" width="6" height="7" rx="0.5" stroke={IC} strokeWidth={1.2} fill="none"/>
    <Path d="M3 9a3 3 0 0 0 6 0M9 9a3 3 0 0 0 6 0M15 9a3 3 0 0 0 6 0" stroke={IC} strokeWidth={1.2} fill="none"/>
  </Svg>
);

const IcoProduct = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z" fill={IF} stroke={IC} strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M3 6h18" stroke={IC} strokeWidth={1.5}/>
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={IC} strokeWidth={1.5} strokeLinecap="round" fill="none"/>
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
  /** Libellé "Toute ma vitrine" personnalisé (ex : "Tout mon registre") */
  allLabel?: string;
  /** Texte affiché quand la liste est vide */
  emptyMessage?: string;
}

export default function ProductPicker({
  products,
  selectedIds,
  allProducts,
  onToggleProduct,
  onToggleAllProducts,
  allLabel,
  emptyMessage,
}: Props) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTxt}>
          {emptyMessage ?? 'Ajoute un produit dans ta vitrine pour pouvoir le mettre en avant.'}
        </Text>
      </View>
    );
  }

  const allRowLabel = allLabel ?? 'Toute ma vitrine';

  return (
    <View style={styles.wrap}>
      {/* Toute la vitrine / Tout le registre */}
      <TouchableOpacity
        style={[styles.card, allProducts && styles.cardSel]}
        onPress={onToggleAllProducts}
        activeOpacity={0.82}
      >
        <View style={[styles.checkbox, allProducts && styles.checkboxSel]}>
          {allProducts && <IcoCheck />}
        </View>
        <View style={styles.imgBox}>
          <IcoStore />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {allRowLabel}
          </Text>
          <Text style={styles.allDesc}>
            {products.length} prestation{products.length > 1 ? 's' : ''}
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
                  <ExpoImage source={{ uri: p.photoUrl }} style={styles.img} contentFit="cover" />
                ) : p.emoji ? (
                  <Text style={styles.emoji}>{p.emoji}</Text>
                ) : (
                  <IcoProduct />
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
