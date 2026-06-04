/**
 * ReportButton — Bouton discret "Signaler un problème".
 * À placer sur l'écran d'une commande ou d'une dette.
 * Ouvre DisputeFormScreen en le poussant sur la pile de navigation.
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoAlert = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      stroke={colors.muted}
    />
    <Path d="M12 9v4M12 17h.01" stroke={colors.muted} />
  </Svg>
);

interface Props {
  onPress: () => void;
}

export default function ReportButton({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.75}>
      <IcoAlert />
      <Text style={styles.txt}>Signaler un problème</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },
});
