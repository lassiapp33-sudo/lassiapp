import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { StoreCategory } from '../../types/store';

interface Props {
  categories:  StoreCategory[];
  active:      string;           // id de la catégorie active
  onSelect:    (id: string) => void;
  onAddCat?:   () => void;
}

export default function CategoryTabs({ categories, active, onSelect, onAddCat }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {categories.map(cat => {
        const on = cat.id === active;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabTxt, on ? styles.tabTxtOn : styles.tabTxtOff]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Bouton ajout catégorie */}
      <TouchableOpacity style={styles.addBtn} onPress={onAddCat} activeOpacity={0.75}>
        <Text style={styles.addTxt}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 36,
    paddingHorizontal: 15,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tabOn: {
    backgroundColor: colors.accent,
  },
  tabOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabTxt: {
    fontFamily: fonts.title,
    fontSize: 13,
  },
  tabTxtOn:  { color: colors.bg    },
  tabTxtOff: { color: colors.muted },

  // Bouton + (dashed border — fonctionne avec borderWidth shorthand)
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 18,
    lineHeight: 22,
  },
});
