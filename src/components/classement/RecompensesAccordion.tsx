import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoChevron = ({ open }: { open: boolean }) => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.5}
    style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
  >
    <Path d="m6 9 6 6 6-6" stroke={colors.muted} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export interface RecompenseItem {
  rang: string;
  badge: string;
  detail: string;
}

interface Props {
  title: string;
  items: RecompenseItem[];
}

// ─── Carte déroulante générique pour lister les récompenses d'un classement ──

export default function RecompensesAccordion({ title, items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <Text style={styles.headerTxt}>{title}</Text>
        <IcoChevron open={open} />
      </TouchableOpacity>

      {open && (
        <View style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={[styles.row, i === items.length - 1 && styles.rowLast]}>
              <View style={styles.rangBadge}>
                <Text style={styles.rangTxt}>{item.rang}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badge}>{item.badge}</Text>
                <Text style={styles.recompenses}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13.5,
    flex: 1,
    marginRight: 10,
  },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rangBadge: {
    minWidth: 56,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(253,207,52,.13)',
    alignItems: 'center',
  },
  rangTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11.5 },
  badge: { color: colors.white, fontFamily: fonts.ui, fontSize: 13, marginBottom: 3 },
  recompenses: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17 },
});
