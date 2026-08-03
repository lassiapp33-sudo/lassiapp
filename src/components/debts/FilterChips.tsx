import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { DebtFilter } from '../../types/debts';

const CHIPS: { id: DebtFilter; label: string; dot?: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'late', label: 'En retard', dot: '#DC2626' },
  { id: 'watch', label: 'À surveiller', dot: '#F97316' },
  { id: 'good', label: 'Bons payeurs', dot: '#16A34A' },
];

interface Props {
  active: DebtFilter;
  onChange: (id: DebtFilter) => void;
}

export default function FilterChips({ active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.row}
    >
      {CHIPS.map(chip => {
        const on = chip.id === active;
        return (
          <TouchableOpacity
            key={chip.id}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
            onPress={() => onChange(chip.id)}
            activeOpacity={0.75}
          >
            {chip.dot && (
              <View style={[styles.dot, { backgroundColor: chip.dot }]} />
            )}
            <Text style={[styles.chipTxt, on ? styles.chipTxtOn : styles.chipTxtOff]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { height: 52 },
  row: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipTxt: {
    fontFamily: fonts.title,
    fontSize: 12,
  },
  chipTxtOn: { color: colors.bg },
  chipTxtOff: { color: colors.muted },
});
