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
import { VisibilityPlan, type PayMethod, type WaveOrangeMethod } from '../../services/visibilityPayment';
import { formatPrice } from '../../utils/format';

const IcoCard = () => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

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

const IcoClock = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={12} cy={12} r={10} stroke={colors.muted} />
    <Path d="M12 6v6l4 2" stroke={colors.muted} />
  </Svg>
);

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 4;

const METHOD_LABELS: Record<PayMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  credit: 'Crédit LASSI',
};

interface Props {
  plan: VisibilityPlan;
  payMethod: PayMethod;
  onMethodChange: (m: PayMethod) => void;
  onPay: () => void;
  loading?: boolean;
  keysAvailable?: { wave: boolean; orange_money: boolean };
  creditBalance: number;
}

export default function PayFooter({
  plan,
  payMethod,
  onMethodChange,
  onPay,
  loading,
  keysAvailable,
  creditBalance,
}: Props) {
  const mobileMethods = (['wave', 'orange_money'] as WaveOrangeMethod[]).filter(
    m => !keysAvailable || keysAvailable[m],
  );
  const allMethods: PayMethod[] = [...mobileMethods, 'credit'];

  const isCredit = payMethod === 'credit';
  const canAfford = creditBalance >= plan.price;
  const isDisabled = loading || (isCredit && !canAfford);

  return (
    <View style={[styles.footer, { paddingBottom: BOTTOM_PAD }]}>
      {/* Résumé sélection */}
      <View style={styles.summary}>
        <Text style={styles.sumLabel}>
          Forfait <Text style={styles.sumBold}>{plan.label}</Text>
        </Text>
        <Text style={styles.sumPrice}>{formatPrice(plan.price)}</Text>
      </View>

      {/* Sélecteur de méthode de paiement */}
      <View style={styles.methods}>
        {allMethods.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.method, payMethod === m && styles.methodSel]}
            onPress={() => onMethodChange(m)}
            activeOpacity={0.75}
          >
            <Text style={[styles.methodTxt, payMethod === m && styles.methodTxtSel]}>
              {METHOD_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Solde crédit LASSI (affiché seulement quand crédit sélectionné) */}
      {isCredit && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Ton crédit LASSI</Text>
          <Text style={[styles.balanceAmount, !canAfford && styles.balanceLow]}>
            {formatPrice(creditBalance)}
          </Text>
        </View>
      )}

      {/* Bouton paiement */}
      <TouchableOpacity
        style={[
          styles.btn,
          loading && styles.btnLoading,
          isCredit && !canAfford && styles.btnInsufficient,
        ]}
        onPress={onPay}
        activeOpacity={0.85}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : isCredit && !canAfford ? (
          <>
            <IcoWallet muted />
            <Text style={styles.btnInsufficientTxt}>Crédit insuffisant</Text>
          </>
        ) : (
          <>
            {isCredit ? <IcoWallet /> : <IcoCard />}
            <Text style={styles.btnTxt}>
              {isCredit ? 'Payer avec mon crédit LASSI' : `Payer via ${METHOD_LABELS[payMethod]}`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {isCredit && !canAfford && (
        <Text style={styles.unavailDesc}>
          Il te manque {formatPrice(plan.price - creditBalance)} de crédit LASSI.
        </Text>
      )}
    </View>
  );
}

// ─── Variante "Bientôt disponible" ────────────────────────────────────────────

export function PayFooterUnavailable({ plan }: { plan: VisibilityPlan }) {
  return (
    <View style={[styles.footer, { paddingBottom: BOTTOM_PAD }]}>
      <View style={styles.summary}>
        <Text style={styles.sumLabel}>
          Forfait <Text style={styles.sumBold}>{plan.label}</Text>
        </Text>
        <Text style={styles.sumPrice}>{formatPrice(plan.price)}</Text>
      </View>
      <View style={styles.btnUnavail}>
        <IcoClock />
        <Text style={styles.btnUnavailTxt}>Paiement bientôt disponible</Text>
      </View>
      <Text style={styles.unavailDesc}>
        Nous intégrons Wave et Orange Money. Revenez très bientôt !
      </Text>
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

  // Sélecteur méthode
  methods: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  method: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodSel: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.08)',
  },
  methodTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  methodTxtSel: {
    color: colors.accent,
    fontFamily: fonts.title,
  },

  // Solde crédit
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
  btnInsufficient: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: 6,
  },
  btnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  btnInsufficientTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 15,
  },

  // État indisponible Wave/OM (PayFooterUnavailable)
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
