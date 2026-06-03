import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

interface Props {
  rank:      string;   // ex : "N°1 Tangana de Dakar"
  subtitle:  string;   // ex : "Tu es champion de la semaine"
  renewIn:   string;   // ex : "3j"
  progress:  number;   // 0 à 1 (ex : 0.78 = 78%)
  progressLabel: string; // ex : "78% vers le maintien"
}

export default function VipScoring({ rank, subtitle, renewIn, progress }: Props) {
  return (
    <View style={styles.card}>
      {/* En-tête : trophée + titre */}
      <View style={styles.top}>
        <View style={styles.trophy}>
          <Text style={styles.trophyIcon}>🏆</Text>
        </View>
        <View style={styles.ti}>
          <Text style={styles.rankTxt}>{rank}</Text>
          <Text style={styles.subTxt}>
            {subtitle}
            {' · '}
            <Text style={styles.subAccent}>renouvelé dans {renewIn}</Text>
          </Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(progress, 1) * 100}%` }]} />
      </View>

      {/* Légendes */}
      <View style={styles.labels}>
        <Text style={styles.lblLeft}>Ton activité cette semaine</Text>
        <Text style={styles.lblRight}>
          <Text style={styles.lblBold}>{Math.round(progress * 100)}%</Text>
          {' vers le maintien'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond légèrement distinct du surface pour contraster avec le reste
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  trophy: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trophyIcon: {
    fontSize: 22,
  },

  ti: { flex: 1 },
  rankTxt: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 14.5,
  },
  subTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  subAccent: {
    color: colors.accent,
    fontFamily: fonts.ui,
  },

  // Barre de progression
  barBg: {
    height: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,.08)',
    overflow: 'hidden',
    marginBottom: 7,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 5,
  },

  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lblLeft: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  lblRight: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  lblBold: {
    color: colors.white,
    fontFamily: fonts.title,
  },
});
