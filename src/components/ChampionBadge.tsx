import React from 'react';
import { Text, StyleSheet } from 'react-native';

// Badge affiché quand le prestataire a une récompense de classement active.
export default function ChampionBadge() {
  return <Text style={styles.trophy}>🏆</Text>;
}

const styles = StyleSheet.create({
  trophy: {
    fontSize: 18,
    lineHeight: 22,
  },
});
