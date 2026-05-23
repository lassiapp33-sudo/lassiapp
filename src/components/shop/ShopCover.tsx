import React from 'react';
import { View, StyleSheet } from 'react-native';

export const COVER_H = 155;

// Bannière pure — sans boutons interactifs.
// Les contrôles (retour / partage / favori) sont rendus HORS du ScrollView
// dans ShopScreen pour éviter les conflits de gestures.
export default function ShopCover() {
  return (
    <View style={styles.cover}>
      <View style={styles.texture} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: COVER_H,
    backgroundColor: '#1a1b38',
    // Pas d'overflow:hidden — empêche les touches sur iOS
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E2040',
    opacity: 0.5,
  },
});
