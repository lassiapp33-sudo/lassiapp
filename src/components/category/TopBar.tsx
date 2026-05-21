import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

interface Props {
  title:    string;
  onBack:   () => void;
  onSearch?: () => void;
}

const IconBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5"         stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

const IconSearch = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={11} cy={11} r={8}    stroke={colors.muted} />
    <Path d="m21 21-4.3-4.3"         stroke={colors.muted} />
  </Svg>
);

const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 46;

export default function TopBar({ title, onBack, onSearch }: Props) {
  return (
    <View style={[styles.bar, { paddingTop: TOP }]}>
      <TouchableOpacity style={styles.btn} onPress={onBack} activeOpacity={0.7}>
        <IconBack />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <TouchableOpacity style={styles.btn} onPress={onSearch} activeOpacity={0.7}>
        <IconSearch />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 19,
  },
});
