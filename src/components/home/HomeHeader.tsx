import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

interface Props {
  quartier?: string;
  initial?:  string;
  onLocation?: () => void;
  onAvatar?:   () => void;
}

const IconPin = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={colors.accent} />
    <Circle cx={12} cy={10} r={3} stroke={colors.accent} />
  </Svg>
);

const IconChevron = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}>
    <Path d="m6 9 6 6 6-6" stroke={colors.muted} />
  </Svg>
);

export default function HomeHeader({ quartier = 'Grand Dakar', initial = 'A', onLocation, onAvatar }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onLocation} activeOpacity={0.7}>
        <View style={styles.locLabel}>
          <IconPin />
          <Text style={styles.locLabelTxt}>Ta position</Text>
        </View>
        <View style={styles.locValue}>
          <Text style={styles.locValueTxt}>{quartier}</Text>
          <IconChevron />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.avatar} onPress={onAvatar} activeOpacity={0.8}>
        <Text style={styles.avatarTxt}>{initial}</Text>
        <View style={styles.dot} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locLabelTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  locValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  locValueTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
