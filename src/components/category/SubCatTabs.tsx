import React from 'react';
import { ScrollView, TouchableOpacity, Text, Image, View, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme';

export interface SubCat {
  id:        string;
  label:     string;
  imageUri?: number;                              // require('../../../assets/xxx.png')
  SvgIcon?:  React.FC<{ color: string }>;        // composant SVG inline
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
      style={styles.bar}
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
            {tab.imageUri || tab.SvgIcon ? (
              <View style={styles.row}>
                {tab.imageUri
                  ? <Image source={tab.imageUri} style={styles.ico} resizeMode="contain" />
                  : tab.SvgIcon
                    ? <tab.SvgIcon color={on ? colors.bg : colors.muted} />
                    : null
                }
                <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>
                  {tab.label}
                </Text>
              </View>
            ) : (
              <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>
                {tab.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68 },
  list: {
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  tab: {
    height: 48,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ico: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  labelOn:  { color: colors.bg },
  labelOff: { color: colors.muted },
});
