import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

export type HomeTab = 'nearby' | 'recent';

interface Props {
  active?: HomeTab;
  onChange?: (tab: HomeTab) => void;
  onNearbyPress?: () => void;
  onRecentPress?: () => void;
  onAlaUnePress?: () => void;
}

const IconCompass = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.muted} />
    <Path d="m16.2 7.8-2 6.3-6.4 2 2-6.3z" stroke={colors.muted} />
  </Svg>
);

const IconClock = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.muted} />
    <Path d="M12 6v6l4 2" stroke={colors.muted} />
  </Svg>
);

const IconFlame = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke={colors.bg} fill={colors.bg + '40'} />
  </Svg>
);

export default function TabSelector({ onNearbyPress, onRecentPress, onAlaUnePress }: Props) {
  return (
    <View style={styles.row}>
      {/* Autour de moi */}
      <TouchableOpacity style={styles.sideBtn} onPress={onNearbyPress} activeOpacity={0.8}>
        <IconCompass />
        <Text style={styles.sideLbl}>Autour de moi</Text>
      </TouchableOpacity>

      {/* À la une — central, accent */}
      <TouchableOpacity style={styles.centerBtn} onPress={onAlaUnePress} activeOpacity={0.85}>
        <IconFlame />
        <Text style={styles.centerLbl}>À la une</Text>
      </TouchableOpacity>

      {/* Vus récemment */}
      <TouchableOpacity style={styles.sideBtn} onPress={onRecentPress} activeOpacity={0.8}>
        <IconClock />
        <Text style={styles.sideLbl}>Vus récemment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 24,
    alignItems: 'stretch',
  },

  // Boutons latéraux
  sideBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.sm,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideLbl: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.muted,
    textAlign: 'center',
  },

  // Bouton central — À la une en accent
  centerBtn: {
    flex: 1.15,
    minHeight: 52,
    borderRadius: radius.md,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centerLbl: {
    fontFamily: fonts.title,
    fontSize: 10.5,
    color: colors.bg,
  },
});
