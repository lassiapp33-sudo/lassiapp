import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { StoreCategory } from '../../types/store';

interface Props {
  categories: StoreCategory[];
  active: string;
  onSelect: (id: string) => void;
  onDeleteCat?: (id: string) => void;
}

export default function CategoryTabs({ categories, active, onSelect, onDeleteCat }: Props) {
  const canDelete = !!onDeleteCat && categories.length > 1;

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
            style={[styles.pill, on && styles.pillOn]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillTxt, on ? styles.pillTxtOn : styles.pillTxtOff]}>
              {cat.label}
            </Text>
            {canDelete && (
              <TouchableOpacity
                style={[styles.delBtn, on && styles.delBtnOn]}
                onPress={() => onDeleteCat(cat.id)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.delTxt, on && styles.delTxtOn]}>×</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  pillOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillTxt: {
    fontFamily: fonts.title,
    fontSize: 13,
  },
  pillTxtOn: { color: colors.bg },
  pillTxtOff: { color: colors.muted },
  delBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  delBtnOn: {
    backgroundColor: 'rgba(20,21,42,0.18)',
  },
  delTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 15,
    fontFamily: fonts.ui,
  },
  delTxtOn: {
    color: 'rgba(20,21,42,0.75)',
  },
});
