import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// Icône tendance haussière
const IcoTrend = () => (
  <Svg
    width={30}
    height={30}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 17l6-6 4 4 8-8" stroke={colors.bg} />
    <Path d="M17 7h4v4" stroke={colors.bg} />
  </Svg>
);

export default function HeroCard() {
  return (
    <View style={styles.card}>
      {/* Icône */}
      <View style={styles.iconWrap}>
        <IcoTrend />
      </View>

      {/* Titre */}
      <Text style={styles.title}>Sois vu partout à Dakar</Text>

      {/* Corps */}
      <Text style={styles.body}>
        {'Mets un produit en avant dans '}
        <Text style={styles.accent}>Offre du quartier</Text>
        {", sur la page d'accueil de tous les clients à proximité. Attire jusqu'à "}
        <Text style={styles.accent}>5× plus de clients</Text>
        {'.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond distinct du surface — bordure accent pour la mise en valeur
  card: {
    marginHorizontal: 18,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  accent: {
    color: colors.accent,
    fontFamily: fonts.title,
  },
});
