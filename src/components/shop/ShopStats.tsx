import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

const StarFilled = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" fill={colors.accent} />
  </Svg>
);

const Divider = () => <View style={styles.div} />;

interface Props {
  rating:      number;
  reviewCount: number;
  distance:    string;
  zone:        string;
  prepTime:    string;
}

export default function ShopStats({ rating, reviewCount, distance, zone, prepTime }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.stat}>
        <View style={styles.val}>
          <StarFilled />
          <Text style={styles.valTxt}>{rating}</Text>
        </View>
        <Text style={styles.lbl}>{reviewCount} avis</Text>
      </View>

      <Divider />

      <View style={styles.stat}>
        <Text style={styles.valTxt}>📍 {distance}</Text>
        <Text style={styles.lbl}>{zone}</Text>
      </View>

      <Divider />

      <View style={styles.stat}>
        <Text style={styles.valTxt}>⏱️ {prepTime}</Text>
        <Text style={styles.lbl}>Préparation</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 18,
    alignItems: 'center',
  },
  stat: { gap: 2 },
  val: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  lbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  div: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
});
