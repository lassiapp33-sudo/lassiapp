import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// ─── Icônes bénéfices ─────────────────────────────────────────────────────────

const IcoStore = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M3 9l1-5h16l1 5M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18"
      stroke={colors.accent} />
  </Svg>
);

const IcoSearch = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Circle cx={11} cy={11} r={8} stroke={colors.accent} />
    <Path d="m21 21-4.3-4.3" stroke={colors.accent} />
  </Svg>
);

const IcoPulse = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={colors.accent} />
  </Svg>
);

// ─── Config bénéfices ─────────────────────────────────────────────────────────

const BENEFITS = [
  {
    Icon: IcoStore,
    title: 'Placement premium sur l\'accueil',
    desc:  'Ta carte apparaît dès l\'ouverture de l\'app',
  },
  {
    Icon: IcoSearch,
    title: 'Visible dans toutes les catégories',
    desc:  'Même quand le client cherche autre chose',
  },
  {
    Icon: IcoPulse,
    title: 'Tunnel direct vers ta boutique',
    desc:  '1 clic = le client entre chez toi',
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function BenefitsList() {
  return (
    <View style={styles.wrap}>
      {BENEFITS.map((b, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.iconBox}>
            <b.Icon />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{b.title}</Text>
            <Text style={styles.desc}>{b.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 22,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(253,207,52,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1 },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },
  desc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
    lineHeight: 16,
  },
});
