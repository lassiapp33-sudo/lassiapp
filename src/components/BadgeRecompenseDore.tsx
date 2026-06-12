import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { colors, fonts, radius } from '../theme';
import ShimmerOverlay from './ShimmerOverlay';

interface Props {
  label: string;
}

// Badge doré scintillant — affiche une récompense active (ex: "👑 Champion Mondial")
// sur la vitrine d'un prestataire.
export default function BadgeRecompenseDore({ label }: Props) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={styles.badge}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && <ShimmerOverlay width={width} />}
      <Text style={styles.txt}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  txt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 11,
  },
});
