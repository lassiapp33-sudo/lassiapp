import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoEye = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke={color} />
    <Circle cx={12} cy={12} r={3} stroke={color} />
  </Svg>
);

const IcoClick = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      stroke={color} />
  </Svg>
);

const IcoChat = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={color} />
  </Svg>
);

const IcoCoin = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={color} />
  </Svg>
);

// ─── Config stats ─────────────────────────────────────────────────────────────

const STATS = [
  {
    Icon: IcoEye,   color: colors.accent,
    value: '3 240', label: 'Vues ce mois',            up: '▲ +18%',
    iconBg: 'rgba(253,207,52,.12)',
  },
  {
    Icon: IcoClick, color: colors.success,
    value: '412',   label: 'Clics vers ta boutique', up: '▲ +24%',
    iconBg: 'rgba(95,211,138,.12)',
  },
  {
    Icon: IcoChat,  color: colors.accent,
    value: '86',    label: 'Discussions lancées',    up: '▲ +12%',
    iconBg: 'rgba(253,207,52,.12)',
  },
  {
    Icon: IcoCoin,  color: colors.success,
    value: '128 K', label: 'Ventes générées (F)',    up: '▲ +31%',
    iconBg: 'rgba(95,211,138,.12)',
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StatsGrid() {
  const pairs = [STATS.slice(0, 2), STATS.slice(2, 4)];

  return (
    <View style={styles.wrap}>
      {pairs.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((stat, si) => (
            <View key={si} style={styles.box}>
              {/* Icône dans carré coloré */}
              <View style={[styles.iconBox, { backgroundColor: stat.iconBg }]}>
                <stat.Icon color={stat.color} />
              </View>

              {/* Valeur principale — grand chiffre */}
              <Text style={styles.value}>{stat.value}</Text>
              <Text style={styles.label}>{stat.label}</Text>
              <Text style={styles.up}>{stat.up}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 18,
    marginBottom: 18,
    gap: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 11,
  },
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 24,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  up: {
    color: colors.success,
    fontFamily: fonts.title,
    fontSize: 10,
    marginTop: 5,
  },
});
