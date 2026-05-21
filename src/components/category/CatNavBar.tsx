import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export type CatId = 'stores' | 'tangana' | 'food' | 'hair' | 'sport' | 'bakery';

interface CatItem {
  id:    CatId;
  label: string;
  icon:  (active: boolean) => React.ReactNode;
}

// Icônes réutilisées depuis la maquette — couleur dynamique selon état actif
const mk = (active: boolean) => active ? colors.accent : colors.muted;

const CATS: CatItem[] = [
  {
    id: 'stores', label: 'Commerçants',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 9l1-5h16l1 5" stroke={mk(a)} /><Path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" stroke={mk(a)} />
        <Path d="M3 9h18" stroke={mk(a)} /><Path d="M9 22V12h6v10" stroke={mk(a)} />
      </Svg>
    ),
  },
  {
    id: 'tangana', label: 'Tangana',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke={mk(a)} />
        <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" stroke={mk(a)} />
        <Path d="M6 2v2M10 2v2M14 2v2" stroke={mk(a)} />
      </Svg>
    ),
  },
  {
    id: 'bakery', label: 'Boulangeries',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 9h12a4 4 0 0 1 4 4v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a4 4 0 0 1 4-4Z" stroke={mk(a)} />
        <Path d="M12 9V5M8 9V6M16 9V6" stroke={mk(a)} />
      </Svg>
    ),
  },
  {
    id: 'food', label: 'Restos',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2M5 2v9M9 2v20" stroke={mk(a)} />
        <Path d="M17 2c-1.7 0-3 1.3-3 3v6h3m0-9v20" stroke={mk(a)} />
      </Svg>
    ),
  },
  {
    id: 'hair', label: 'Coiffeurs',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 2l1 6M18 2l-1 6" stroke={mk(a)} />
        <Circle cx={12} cy={6} r={3} stroke={mk(a)} />
        <Path d="M6 8c-2 0-3 2-3 4s1 9 1 9M18 8c2 0 3 2 3 4s-1 9-1 9" stroke={mk(a)} />
      </Svg>
    ),
  },
  {
    id: 'sport', label: 'Fitness',
    icon: a => (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6.5 6.5 17.5 17.5M3 8l2-2M19 16l2-2M8 3l2 2M14 19l2 2" stroke={mk(a)} />
        <Rect x={2} y={9} width={4} height={6} rx={1} transform="rotate(45 4 12)" stroke={mk(a)} />
      </Svg>
    ),
  },
];

interface Props {
  active:   CatId;
  onSelect: (id: CatId) => void;
}

export default function CatNavBar({ active, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {CATS.map(cat => {
        const on = cat.id === active;
        return (
          <TouchableOpacity
            key={cat.id}
            style={styles.pill}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <View style={[styles.ico, on && styles.icoOn]}>
              {cat.icon(on)}
            </View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 2,
  },
  pill: {
    width: 62,
    alignItems: 'center',
    gap: 6,
  },
  ico: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icoOn: {
    backgroundColor: 'rgba(253, 207, 52, 0.12)',
    borderColor: colors.accent,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 13,
  },
  labelOn: { color: colors.accent },
});
