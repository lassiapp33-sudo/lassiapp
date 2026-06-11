import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, TOP_INSET } from '../../theme';
import useConnectionStore from '../../store/connectionStore';

/**
 * Section 10 — Mode dégradé : bandeau affiché tant que Supabase est
 * injoignable. L'app continue de fonctionner avec les dernières données
 * connues (caches locaux) au lieu d'afficher un écran cassé.
 */
export default function OfflineBanner() {
  const isOffline = useConnectionStore(s => s.isOffline);
  if (!isOffline) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.text}>Pas de connexion — mode hors-ligne</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: TOP_INSET,
    paddingBottom: 7,
    alignItems: 'center',
    backgroundColor: colors.orange,
    zIndex: 999,
  },
  text: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
});
