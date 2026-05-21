import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';

export interface SubCat {
  id:    string;
  label: string;
}

interface Props {
  tabs:     SubCat[];
  active:   string;
  onChange: (id: string) => void;
}

export default function SubCatTabs({ tabs, active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {tabs.map(tab => {
        const on = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  tab: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn:  { backgroundColor: colors.accent },
  tabOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  labelOn:  { color: colors.bg },
  labelOff: { color: colors.muted },
});
