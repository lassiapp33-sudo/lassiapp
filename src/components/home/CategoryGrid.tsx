import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

interface Category {
  id:        string;
  label:     string;
  icon:      React.ReactNode;
  oneLine?:  boolean;
  itemWidth?: number;
}

// Icônes SVG fidèles à la maquette
const S = colors.accent; // stroke accent

const IcoStore = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l1-5h16l1 5" stroke={S} /><Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={S} />
    <Path d="M3 9h18" stroke={S} /><Path d="M9 22V12h6v10" stroke={S} />
  </Svg>
);

const IcoCoffee = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke={S} />
    <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" stroke={S} />
    <Path d="M6 2v2M10 2v2M14 2v2" stroke={S} />
  </Svg>
);

const IcoFood = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2M5 2v9M9 2v20" stroke={S} />
    <Path d="M17 2c-1.7 0-3 1.3-3 3v6h3m0-9v20" stroke={S} />
  </Svg>
);

const IcoHair = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 2l1 6M6 8c-2 0-3 2-3 4s1 9 1 9M18 2l-1 6M18 8c2 0 3 2 3 4s-1 9-1 9" stroke={S} />
    <Circle cx={12} cy={6} r={3} stroke={S} />
  </Svg>
);

const IcoSport = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6.5 6.5 17.5 17.5M3 8l2-2M19 16l2-2M8 3l2 2M14 19l2 2M6.5 6.5 5 8M17.5 17.5 19 16" stroke={S} />
    <Rect x={2} y={9} width={4} height={6} rx={1} transform="rotate(45 4 12)" stroke={S} />
  </Svg>
);

const IcoBakery = () => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9h12a4 4 0 0 1 4 4v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a4 4 0 0 1 4-4Z" stroke={S} />
    <Path d="M12 9V5M8 9V6M16 9V6" stroke={S} />
  </Svg>
);

const CATEGORIES: Category[] = [
  { id: 'stores',  label: 'Commerçants\ndu quartier', icon: <IcoStore />,  oneLine: false, itemWidth: 82 },
  { id: 'tangana', label: 'Tangana / Ndéki',          icon: <IcoCoffee /> },
  { id: 'bakery',  label: 'Boulangeries',              icon: <IcoBakery />, oneLine: true  },
  { id: 'food',    label: 'Restos & Boissons',         icon: <IcoFood /> },
  { id: 'hair',    label: 'Coiffeurs',                 icon: <IcoHair /> },
  { id: 'sport',   label: 'Fitness',                   icon: <IcoSport /> },
];

interface Props {
  onSelect?: (id: string, label: string) => void;
}

export default function CategoryGrid({ onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {CATEGORIES.map(cat => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.item, cat.itemWidth ? { width: cat.itemWidth } : undefined]}
          onPress={() => onSelect?.(cat.id, cat.label)}
          activeOpacity={0.75}
        >
          <View style={styles.ico}>{cat.icon}</View>
          <Text
            style={styles.label}
            numberOfLines={cat.oneLine ? 1 : undefined}
            adjustsFontSizeToFit={cat.oneLine}
          >{cat.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 6 },
  item: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  ico: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});
