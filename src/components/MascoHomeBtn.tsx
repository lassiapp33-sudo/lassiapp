import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';
import usePendingNavStore from '../store/pendingNavStore';

interface Props {
  style?: object;
}

// Bouton d'en-tête avec la mascotte Lassi roi.
// Au clic → retour à l'accueil (via pendingNavStore, fonctionne depuis n'importe
// quelle profondeur de navigation, client ou prestataire).
export default function MascoHomeBtn({ style }: Props) {
  const setPendingNav = usePendingNavStore(s => s.setPendingNav);

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => setPendingNav({ type: 'home' })}
      activeOpacity={0.75}
    >
      <Image
        source={require('../../assets/mascotte/lassi-roi.png')}
        style={styles.img}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
