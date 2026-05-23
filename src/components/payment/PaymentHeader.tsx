import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';

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

export default function PaymentHeader({ title, onBack }: Props) {
  return (
    <View style={[styles.head, { paddingTop: TOP_INSET + 8 }]}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.8}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.bg,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 18,
  },
});
