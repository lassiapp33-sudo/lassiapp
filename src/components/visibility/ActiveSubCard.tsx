import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

const IcoCheck = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.5}>
    <Path d="M20 6 9 17l-5-5" stroke="rgba(20,21,42,.7)" />
  </Svg>
);

interface Props {
  planLabel: string; // ex: "3 mois"
  daysLeft: number; // jours restants
  expiryDate: string; // ex: "21 juillet 2026"
  progress: number; // 0–1 : fraction du temps ÉCOULÉ
  productName?: string | null;
  productEmoji?: string | null;
}

export default function ActiveSubCard({
  planLabel,
  daysLeft,
  expiryDate,
  progress,
  productName,
  productEmoji,
}: Props) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.card}>
      {/* Statut */}
      <View style={styles.statusRow}>
        <IcoCheck />
        <Text style={styles.statusTxt}>Forfait actif · {planLabel}</Text>
      </View>

      {/* Titre */}
      <Text style={styles.title}>Offre du quartier active</Text>

      {/* Produit annoncé */}
      {!!productName && (
        <Text style={styles.product} numberOfLines={1}>
          {productEmoji || '🛍️'} {productName}
        </Text>
      )}

      {/* Expiration */}
      <Text style={styles.left}>
        Expire dans {daysLeft} jour{daysLeft > 1 ? 's' : ''} · {expiryDate}
      </Text>

      {/* Barre de progression (temps écoulé) */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${Math.round(clampedProgress * 100)}%` }]} />
      </View>
    </View>
  );
}

export function computeSubCardProps(sub: {
  planLabel: string;
  startedAt: string;
  expiresAt: string;
}): { planLabel: string; daysLeft: number; expiryDate: string; progress: number } {
  const now = Date.now();
  const start = new Date(sub.startedAt).getTime();
  const end = new Date(sub.expiresAt).getTime();
  const total = Math.max(end - start, 1);
  const elapsed = now - start;
  const remaining = Math.max(end - now, 0);

  return {
    planLabel: sub.planLabel,
    daysLeft: Math.ceil(remaining / 86_400_000),
    expiryDate: new Date(sub.expiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    progress: Math.min(1, Math.max(0, elapsed / total)),
  };
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.accent,
    borderRadius: 22,
    padding: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  statusTxt: {
    color: 'rgba(20,21,42,.7)',
    fontFamily: fonts.titleXL,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  title: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 22,
    marginBottom: 3,
  },
  product: {
    color: 'rgba(20,21,42,.75)',
    fontFamily: fonts.title,
    fontSize: 13,
    marginBottom: 8,
  },
  left: {
    color: 'rgba(20,21,42,.65)',
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  progressBg: {
    height: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(20,21,42,.15)',
    marginTop: 13,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.bg,
    borderRadius: 5,
  },
});
