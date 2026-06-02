import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoClock = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} />
  </Svg>
);

interface Props {
  /** "Ouvert", "Fermé", "Fermé aujourd'hui", "Exceptionnellement fermé" */
  statusLabel:  string;
  /** "Ferme dans 40min", "Ouvre à 7h", ou "" */
  nextChange:   string;
  /** Plage du jour "7h – 22h" ou null si horaires non définis */
  todayHours:   string | null;
  /** "Sur place", "Sur rendez-vous", "Abonnement" */
  orderType:    string;
  isOpen:       boolean;
}

export default function ShopInfoBar({
  statusLabel, nextChange, todayHours, orderType, isOpen,
}: Props) {
  // Ligne principale
  const mainText = (() => {
    if (isOpen && todayHours) return `Ouvert · ${todayHours}`;
    if (isOpen)               return 'Ouvert';
    if (nextChange)           return nextChange;   // ex: "Ouverture Demain à 7h"
    return statusLabel;
  })();

  // Indication secondaire : heure de fermeture quand ouvert
  const secondary = isOpen && nextChange ? nextChange : null;

  return (
    <View style={styles.bar}>
      <IcoClock />
      <View style={{ flex: 1 }}>
        <Text style={styles.txt}>
          <Text style={[styles.status, isOpen ? styles.open : styles.closed]}>
            {mainText}
          </Text>
          {orderType ? (
            <>{'  ·  '}<Text style={styles.orderTxt}>{orderType}</Text></>
          ) : null}
        </Text>
        {secondary ? (
          <Text style={styles.secondary}>{secondary}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  txt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  status: {
    fontFamily: fonts.ui,
  },
  open: {
    color: '#4ade80',  // vert
  },
  closed: {
    color: colors.danger,
  },
  orderTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 11.5,
  },
  secondary: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },
});
