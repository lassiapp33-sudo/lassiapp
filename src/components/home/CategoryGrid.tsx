import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { CatId, CATEGORIES } from '../../config/categories';

// Overrides d'affichage spécifiques à cette grille (label raccourci, largeur, multiligne)
const DISPLAY: Partial<Record<CatId, { label?: string; oneLine?: boolean; itemWidth?: number }>> = {
  stores: { label: 'Commerçants\ndu quartier', itemWidth: 82 },
  hair:   { label: 'Coiffeurs' },
  sport:  { label: 'Fitness' },
  bakery: { oneLine: true },
};

const S = colors.accent;

interface Props {
  onSelect?: (id: string, label: string) => void;
}

export default function CategoryGrid({ onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {CATEGORIES.map(cat => {
        const d = DISPLAY[cat.id] ?? {};
        const label    = d.label    ?? cat.label;
        const oneLine  = d.oneLine  ?? false;
        const itemWidth = d.itemWidth;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.item, itemWidth ? { width: itemWidth } : undefined]}
            onPress={() => onSelect?.(cat.id, label)}
            activeOpacity={0.75}
          >
            <View style={styles.ico}>{cat.renderIcon(S, 30)}</View>
            <Text
              style={styles.label}
              numberOfLines={oneLine ? 1 : undefined}
              adjustsFontSizeToFit={oneLine}
            >{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 6 },
  item: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  ico: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});
