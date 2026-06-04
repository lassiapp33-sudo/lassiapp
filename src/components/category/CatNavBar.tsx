import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { CatId, CATEGORIES } from '../../config/categories';

// Re-export pour compatibilité des imports existants
export type { CatId } from '../../config/categories';

const mk = (active: boolean) => (active ? colors.accent : colors.muted);

interface Props {
  active: CatId;
  onSelect: (id: CatId) => void;
}

export default function CatNavBar({ active, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.list}
    >
      {CATEGORIES.map(cat => {
        const on = cat.id === active;
        return (
          <TouchableOpacity
            key={cat.id}
            style={styles.pill}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <View style={[styles.ico, on && styles.icoOn]}>{cat.renderIcon(mk(on), 24)}</View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 89 },
  list: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 2,
  },
  pill: {
    width: 62,
    alignItems: 'center',
    gap: 6,
  },
  ico: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icoOn: {
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    borderColor: colors.accent,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 13,
  },
  labelOn: { color: colors.accent },
});
