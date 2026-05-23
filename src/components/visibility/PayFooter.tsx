import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { Plan } from './PlanCard';

const IcoCard = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 4;

interface Props {
  plan:   Plan;
  onPay:  () => void;
}

export default function PayFooter({ plan, onPay }: Props) {
  return (
    <View style={[styles.footer, { paddingBottom: BOTTOM_PAD }]}>
      {/* Résumé sélection */}
      <View style={styles.summary}>
        <Text style={styles.sumLabel}>
          Forfait <Text style={styles.sumBold}>{plan.label}</Text>
        </Text>
        <Text style={styles.sumPrice}>
          {plan.price.toLocaleString('fr-FR')} F
        </Text>
      </View>

      {/* Bouton paiement */}
      <TouchableOpacity style={styles.btn} onPress={onPay} activeOpacity={0.85}>
        <IcoCard />
        <Text style={styles.btnTxt}>Activer · payer via Wave</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sumLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  sumBold: {
    color: colors.white,
    fontFamily: fonts.title,
  },
  sumPrice: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 22,
  },
  btn: {
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  btnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
});
