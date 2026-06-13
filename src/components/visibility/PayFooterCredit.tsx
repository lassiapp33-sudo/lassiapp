import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { VisibilityPlan } from '../../services/visibilityPayment';
import { formatPrice } from '../../utils/format';

const IcoWallet = ({ muted }: { muted?: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={6} width={20} height={13} rx={2} stroke={muted ? colors.muted : colors.bg} />
    <Path d="M2 10h20" stroke={muted ? colors.muted : colors.bg} />
    <Circle cx={17} cy={14.5} r={1.4} fill={muted ? colors.muted : colors.bg} stroke="none" />
  </Svg>
);

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 4;

interface Props {
  plan: VisibilityPlan;
  /** Solde de crédit LASSI dépensable, en FCFA. */
  creditBalance: number;
  onPay: () => void;
  loading?: boolean;
}

/** Footer "Payer avec mon crédit LASSI" — alternative à Wave/OM tant que les
 * clés API ne sont pas configurées. Activation immédiate du forfait. */
export default function PayFooterCredit({ plan, creditBalance, onPay, loading }: Props) {
  const enough = creditBalance >= plan.price;

  return (
    <View style={[styles.footer, { paddingBottom: BOTTOM_PAD }]}>
      <View style={styles.summary}>
        <Text style={styles.sumLabel}>
          Forfait <Text style={styles.sumBold}>{plan.label}</Text>
        </Text>
        <Text style={styles.sumPrice}>{formatPrice(plan.price)}</Text>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Ton crédit LASSI</Text>
        <Text style={[styles.balanceAmount, !enough && styles.balanceLow]}>
          {formatPrice(creditBalance)}
        </Text>
      </View>

      {enough ? (
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnLoading]}
          onPress={onPay}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <IcoWallet />
              <Text style={styles.btnTxt}>Payer avec mon crédit LASSI</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.btnUnavail}>
            <IcoWallet muted />
            <Text style={styles.btnUnavailTxt}>Crédit insuffisant</Text>
          </View>
          <Text style={styles.unavailDesc}>
            Il te manque {formatPrice(plan.price - creditBalance)} de crédit LASSI pour activer ce
            forfait. Le paiement Wave / Orange Money arrive très bientôt !
          </Text>
        </>
      )}
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

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  balanceLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  balanceAmount: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  balanceLow: {
    color: colors.danger,
  },

  // Bouton payer
  btn: {
    height: 55,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  btnLoading: {
    opacity: 0.7,
  },
  btnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },

  // État indisponible (crédit insuffisant)
  btnUnavail: {
    height: 55,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  btnUnavailTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  unavailDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
