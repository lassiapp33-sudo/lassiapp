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
                  <Image source={tab.imageUri} style={styles.ico} contentFit="cover" cachePolicy="memory-disk" transition={0} />
                ) : tab.SvgIcon ? (
                  <View style={styles.svgWrap}>
                    <View style={styles.svgScale}>
                      <tab.SvgIcon color={on ? colors.bg : colors.muted} />
                    </View>
                  </View>
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
  bar: { height: 54 },
  list: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tab: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  labelOn: { color: colors.bg },
  labelOff: { color: colors.muted },
  svgWrap: {
    width: 22,
    height: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgScale: {
    width: 36,
    height: 36,
    transform: [{ scale: 22 / 36 }],
  },
});
