import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export type HomeTab = 'nearby' | 'favorites';

interface Props {
  active:   HomeTab;
  onChange: (tab: HomeTab) => void;
}

const IconCompass = ({ active }: { active: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={active ? colors.bg : colors.muted} />
    <Path d="m16.2 7.8-2 6.3-6.4 2 2-6.3z" stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

const IconStar = ({ active }: { active: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 17.8 5.8 21 7 14.1 2 9.3l7-1L12 2l3 6.3 7 1-5 4.8 1.2 6.9z"
      stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

export default function TabSelector({ active, onChange }: Props) {
  const tabs: { id: HomeTab; label: string }[] = [
    { id: 'nearby',    label: 'Autour de moi' },
    { id: 'favorites', label: 'Mes favoris'   },
  ];

  return (
    <View style={styles.row}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive ? styles.tabActive : styles.tabIdle]}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.8}
          >
            {tab.id === 'nearby'
              ? <IconCompass active={isActive} />
              : <IconStar    active={isActive} />
            }
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelIdle]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabIdle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: 13.5,
  },
  labelActive: { color: colors.bg },
  labelIdle:   { color: colors.muted },
});
