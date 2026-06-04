import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

interface Props {
  count: number;
  total: number;
  onPress: () => void;
  bottom: number; // positionné dynamiquement au-dessus du footer
}

// Apparaît uniquement quand le panier contient au moins un article
export default function CartFloating({ count, total, onPress, bottom }: Props) {
  if (count === 0) return null;

  return (
    <TouchableOpacity style={[styles.bar, { bottom }]} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.badge}>
        <Text style={styles.badgeTxt}>{count}</Text>
      </View>
      <Text style={styles.label}>Voir mon panier</Text>
      <Text style={styles.price}>{formatPrice(total)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Ombre prononcée pour remonter visuellement au-dessus du contenu
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 12,
  },
  label: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  price: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
});
