import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../../theme';

export interface SubCat {
  id: string;
  label: string;
  imageUri?: number; // require('../../../assets/xxx.png')
  SvgIcon?: React.FC<{ color: string }>; // composant SVG inline
  imageSize?: number; // taille custom (défaut 36)
}

interface Props {
  tabs: SubCat[];
  active: string;
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
                {tab.imageUri ? (
                  <Image source={tab.imageUri} style={[styles.ico, tab.imageSize ? { width: tab.imageSize, height: tab.imageSize } : null]} contentFit="contain" cachePolicy="memory-disk" transition={0} />
                ) : tab.SvgIcon ? (
                  <tab.SvgIcon color={on ? colors.bg : colors.muted} />
                ) : null}
                <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>
                  {tab.label}
                </Text>
              </View>
            ) : (
              <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]}>{tab.label}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 60 },
  list: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  tab: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.accent },
  tabOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ico: {
    width: 26,
    height: 26,
    borderRadius: 5,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  labelOn: { color: colors.bg },
  labelOff: { color: colors.muted },
});
