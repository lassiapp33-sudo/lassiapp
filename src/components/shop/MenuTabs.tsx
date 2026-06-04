import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';

export type MenuTabId = string;

export interface MenuTab {
  id: MenuTabId;
  label: string;
}

interface Props {
  tabs: MenuTab[];
  active: MenuTabId;
  onPress: (id: MenuTabId) => void;
}

// Le wrapper a le bg du fond pour être opaque quand il devient sticky
export default function MenuTabs({ tabs, active, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {tabs.map(tab => {
          const on = tab.id === active;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
              onPress={() => onPress(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabTxt, on ? styles.tabTxtOn : styles.tabTxtOff]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // backgroundColor obligatoire pour que le sticky cache le contenu derrière
  wrap: {
    backgroundColor: colors.bg,
    paddingVertical: 14,
  },
  content: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    height: 36,
    paddingHorizontal: 15,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  tabTxtOn: { color: colors.bg },
  tabTxtOff: { color: colors.muted },
});
