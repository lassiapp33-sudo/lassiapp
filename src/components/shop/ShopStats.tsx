import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';

const StarFilled = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" fill={colors.accent} />
  </Svg>
);

const StarEmpty = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
    <Path d="M12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9z" stroke={colors.muted} />
  </Svg>
);

const Divider = () => <View style={styles.div} />;

// Seuil : 7 jours — aligne sur la durée du cadeau de bienvenue
const MATURE_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  rating: number;
  reviewsCount: number;
  ordersCount: number;
  createdAt: string; // ISO — pour calculer l'âge de la boutique
  zone: string;
  distanceText?: string | null; // "2.3 km · ~18 min à pied"
  noGps?: boolean; // GPS refusé mais shop a des coords
}

export default function ShopStats({
  rating,
  reviewsCount,
  ordersCount,
  createdAt,
  zone,
  distanceText,
  noGps,
}: Props) {
  // La boutique a-t-elle plus de 4 mois ?
  const isMature = Date.now() - new Date(createdAt).getTime() >= MATURE_MS;

  // Logique d'affichage de la réputation :
  //   "Nouveau"  → âge < 7 jours ET aucune commande ni avis
  //   "Établi"   → âge >= 7 jours ET aucune activité (note invisible)
  //   Note réelle → commandes validées OU vrais avis
  const hasActivity = ordersCount > 0 || reviewsCount > 0;
  const showNouveauBadge = !isMature && !hasActivity;
  const showEtabli = isMature && !hasActivity;

  // Libellé du sous-titre de la note
  const ratingLabel = (() => {
    if (reviewsCount > 0) return `${reviewsCount} avis`;
    if (ordersCount > 0) return `${ordersCount} commande${ordersCount > 1 ? 's' : ''}`;
    return 'Établi';
  })();

  // Distance
  const showDistanceCol = distanceText != null || noGps === true;

  return (
    <View style={styles.row}>
      {/* ── Réputation ───────────────────────────────────────── */}
      {showNouveauBadge ? (
        // Badge "Nouveau" — âge < 4 mois, aucune commande
        <View style={styles.newBadge}>
          <Text style={styles.newTxt}>✨ Nouveau</Text>
        </View>
      ) : showEtabli ? (
        // "Établi" — âge >= 4 mois mais aucune activité encore
        <View style={styles.etabliBadge}>
          <StarEmpty />
          <Text style={styles.etabliTxt}>Établi</Text>
        </View>
      ) : (
        // Note calculée — commandes + éventuels vrais avis
        <View style={styles.stat}>
          <View style={styles.val}>
            <StarFilled />
            <Text style={styles.valTxt}>{rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.lbl}>{ratingLabel}</Text>
        </View>
      )}

      {/* ── Distance / localisation ───────────────────────────── */}
      {showDistanceCol ? (
        <>
          <Divider />
          <View style={styles.stat}>
            {distanceText ? (
              <>
                <Text style={styles.valTxt}>📍 {distanceText.split(' · ')[0]}</Text>
                <Text style={styles.lbl}>{distanceText.split(' · ')[1] ?? zone}</Text>
              </>
            ) : (
              <Text style={styles.noGpsTxt}>Active ta position{'\n'}pour voir la distance</Text>
            )}
          </View>
        </>
      ) : zone ? (
        <>
          <Divider />
          <View style={styles.stat}>
            <Text style={styles.valTxt}>📍 {zone}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 18,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stat: { gap: 2 },
  val: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  lbl: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  div: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // Badge "Nouveau" (< 7 jours, 0 commande, 0 avis)
  newBadge: {
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },

  // Badge "Établi" (>= 4 mois mais sans activité)
  etabliBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etabliTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11.5,
  },

  // "Active ta position"
  noGpsTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    lineHeight: 15,
  },
});
