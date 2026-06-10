import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';
import { StoreProduct } from '../../types/store';

interface Props {
  products: StoreProduct[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ProductPicker({ products, selectedId, onSelect }: Props) {
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
      {products.map(p => {
        const selected = p.id === selectedId;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.card, selected && styles.cardSel]}
            onPress={() => onSelect(p.id)}
            activeOpacity={0.82}
          >
            {/* Radio */}
            <View style={[styles.radio, selected && styles.radioSel]}>
              {selected && <View style={styles.radioDot} />}
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

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSel: { borderColor: colors.accent },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
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
