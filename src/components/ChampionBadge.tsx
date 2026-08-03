import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';
import ShimmerOverlay from './ShimmerOverlay';
import { IcoCrown } from './common/LassiIcons';

const SIZE = 20;

// Petit badge doré scintillant — affiché à côté du nom sur les cartes de liste
// quand le prestataire a une récompense de classement active.
export default function ChampionBadge() {
  return (
    <View style={styles.badge}>
      <ShimmerOverlay width={SIZE} />
      <IcoCrown size={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
