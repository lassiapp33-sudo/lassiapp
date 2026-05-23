import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoClock = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} />
  </Svg>
);

interface Props {
  hours:     string;   // ex : "06h00 à 11h30"
  orderType: string;   // ex : "À emporter ou sur place"
}

export default function ShopInfoBar({ hours, orderType }: Props) {
  return (
    <View style={styles.bar}>
      <IcoClock />
      <Text style={styles.txt}>
        {'Ouvert aujourd\'hui de '}
        <Text style={styles.bold}>{hours}</Text>
        {'  ·  '}{orderType}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txt: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 18,
  },
  bold: {
    color: colors.white,
    fontFamily: fonts.ui,
  },
});
