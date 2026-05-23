import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { OrderStatus } from '../../types/orders';

const TABS: Array<{ id: OrderStatus; label: string }> = [
  { id: 'new',       label: 'Nouvelles'       },
  { id: 'preparing', label: 'En préparation'  },
  { id: 'ready',     label: 'Prêtes'          },
  { id: 'done',      label: 'Terminées'       },
];

interface Props {
  active:   OrderStatus;
  counts:   Record<OrderStatus, number>;
  onChange: (s: OrderStatus) => void;
}

export default function StatusTabs({ active, counts, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.strip}
    >
      {TABS.map(tab => {
        const on    = tab.id === active;
        const count = counts[tab.id];
        const showBadge = count > 0;

        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabTxt, on ? styles.tabTxtOn : styles.tabTxtOff]}>
              {tab.label}
            </Text>
            {showBadge && (
              <View style={[styles.badge, on ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeTxt, on ? styles.badgeTxtOn : styles.badgeTxtOff]}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, flexShrink: 0 },
  row: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },
  tabOn:  { backgroundColor: colors.accent },
  tabOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabTxt: { fontFamily: fonts.title, fontSize: 13 },
  tabTxtOn:  { color: colors.bg    },
  tabTxtOff: { color: colors.muted },

  // Badge compteur
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeOn:  { backgroundColor: 'rgba(20,21,42,.2)' },
  badgeOff: { backgroundColor: colors.danger       },
  badgeTxt: { fontFamily: fonts.titleXL, fontSize: 10 },
  badgeTxtOn:  { color: colors.bg    },
  badgeTxtOff: { color: colors.white },
});
