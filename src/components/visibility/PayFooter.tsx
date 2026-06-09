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
import { VisibilityPlan, type PayMethod } from '../../services/visibilityPayment';
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
};

interface Props {
  plan: VisibilityPlan;
  payMethod: PayMethod;
  onMethodChange: (m: PayMethod) => void;
  onPay: () => void;
  loading?: boolean;
}

export default function PayFooter({ plan, payMethod, onMethodChange, onPay, loading }: Props) {
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
        {(['wave', 'orange_money'] as PayMethod[]).map(m => (
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

      {/* Bouton paiement */}
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
            <IcoCard />
            <Text style={styles.btnTxt}>Payer via {METHOD_LABELS[payMethod]}</Text>
          </>
        )}
      </TouchableOpacity>
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

  // État indisponible
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
