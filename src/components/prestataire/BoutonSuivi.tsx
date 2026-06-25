import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ouvrirNavigation } from '../../utils/navigation';
import { colors, fonts, radius } from '../../theme';

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  adresse?: string | null;
  nomBoutique?: string | null;
  onSuivi?: () => void;
}

const IcoNav = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11 22 2 13 21 11 13 3 11z" stroke={colors.accent} fill="none" />
  </Svg>
);

export default function BoutonSuivi({ latitude, longitude, adresse, nomBoutique, onSuivi }: Props) {
  const handlePress = () => {
    if (onSuivi && latitude != null && longitude != null) {
      onSuivi();
    } else {
      ouvrirNavigation({ latitude, longitude, adresse, nomLieu: nomBoutique });
    }
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={handlePress} activeOpacity={0.85}>
      <IcoNav />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>M'y rendre</Text>
        <Text style={styles.sub}>Suivi GPS jusqu'à la boutique</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginTop: 10,
  },
  label: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 15,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});
