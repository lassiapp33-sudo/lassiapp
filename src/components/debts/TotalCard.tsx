import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Debtor } from '../../types/debts';

const IcoCoin = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
      stroke={colors.danger} />
  </Svg>
);

interface LegendDotProps { color: string; count: number; label: string; }

function LegendDot({ color, count, label }: LegendDotProps) {
  return (
    <View style={styles.lg}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.lgTxt}>
        <Text style={styles.lgBold}>{count}</Text> {label}
      </Text>
    </View>
  );
}

interface Props { debtors: Debtor[]; }

export default function TotalCard({ debtors }: Props) {
  const total = debtors.reduce((s, d) => s + d.amount, 0);
  const lateCount  = debtors.filter(d => d.status === 'late').length;
  const watchCount = debtors.filter(d => d.status === 'watch').length;
  const goodCount  = debtors.filter(d => d.status === 'good').length;

  return (
    <View style={styles.card}>
      {/* Label */}
      <View style={styles.lbl}>
        <IcoCoin />
        <Text style={styles.lblTxt}>Total qu'on te doit</Text>
      </View>

      {/* Montant — gros chiffre lisible en plein soleil */}
      <Text style={styles.amount}>
        {total.toLocaleString('fr-FR')}{' '}
        <Text style={styles.fcfa}>FCFA</Text>
      </Text>

      {/* Légende pastilles */}
      <View style={styles.legend}>
        <LegendDot color={colors.success} count={goodCount}  label="bons payeurs"  />
        <LegendDot color={colors.orange}  count={watchCount} label="à surveiller"  />
        <LegendDot color={colors.danger}  count={lateCount}  label="en retard"     />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
  },
  lbl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lblTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  amount: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 32,
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 14,
  },
  fcfa: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 18,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  lg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  lgTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  lgBold: {
    color: colors.white,
    fontFamily: fonts.title,
  },
});
