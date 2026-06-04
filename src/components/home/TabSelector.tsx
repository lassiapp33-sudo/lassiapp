import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

export type HomeTab = 'nearby' | 'recent';

interface Props {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
  onNearbyPress?: () => void;
  onRecentPress?: () => void;
}

const IconCompass = ({ active }: { active: boolean }) => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={12} r={10} stroke={active ? colors.bg : colors.muted} />
    <Path d="m16.2 7.8-2 6.3-6.4 2 2-6.3z" stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

const IconClock = ({ active }: { active: boolean }) => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={12} r={10} stroke={active ? colors.bg : colors.muted} />
    <Path d="M12 6v6l4 2" stroke={active ? colors.bg : colors.muted} />
  </Svg>
);

export default function TabSelector({ active, onChange, onNearbyPress, onRecentPress }: Props) {
  const tabs: { id: HomeTab; label: string }[] = [
    { id: 'nearby', label: 'Autour de moi' },
    { id: 'recent', label: 'Vus récemment' },
  ];

  return (
    <View style={styles.row}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive ? styles.tabActive : styles.tabIdle]}
            onPress={() => {
              if (tab.id === 'nearby') {
                onNearbyPress?.();
                return;
              }
              if (tab.id === 'recent') {
                onRecentPress?.();
                return;
              }
              onChange(tab.id);
            }}
            activeOpacity={0.8}
          >
            {tab.id === 'nearby' ? (
              <IconCompass active={isActive} />
            ) : (
              <IconClock active={isActive} />
            )}
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
  labelIdle: { color: colors.muted },
});
