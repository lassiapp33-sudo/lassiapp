import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';

const IcoBack = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5" stroke={colors.white} />
    <Path d="M12 19l-7-7 7-7" stroke={colors.white} />
  </Svg>
);

interface Props {
  title:  string;
  onBack: () => void;
}

export default function VisibilityHeader({ title, onBack }: Props) {
  return (
    <View style={[styles.row, { paddingTop: TOP_INSET + 4 }]}>
      <TouchableOpacity style={styles.btn} onPress={onBack} activeOpacity={0.8}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
    fontFamily: fonts.titleXL,
    fontSize: 18,
  },
});
