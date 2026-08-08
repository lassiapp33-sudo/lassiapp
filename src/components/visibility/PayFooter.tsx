import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path, Rect, Circle, Polyline } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { VisibilityPlan, type PayMethod } from '../../services/visibilityPayment';
import { formatPrice } from '../../utils/format';
import { WAVE_ENABLED } from '../../config/features';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" stroke={colors.bg} />
  </Svg>
);

const IcoLock = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={11} width={18} height={11} rx={2} stroke={colors.muted} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.muted} />
  </Svg>
);

const IcoCard = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const IcoWallet = ({ muted }: { muted?: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={6} width={20} height={13} rx={2} stroke={muted ? colors.muted : colors.bg} />
    <Path d="M2 10h20" stroke={muted ? colors.muted : colors.bg} />
    <Circle cx={17} cy={14.5} r={1.4} fill={muted ? colors.muted : colors.bg} stroke="none" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 4;

interface Props {
  plan: VisibilityPlan;
  payMethod: PayMethod;
  onMethodChange: (m: PayMethod) => void;
  onPay: () => void;
  loading?: boolean;
  keysAvailable?: { wave: boolean; orange_money: boolean };
  creditBalance: number;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PayFooter({
  plan,
  payMethod,
  onMethodChange,
  onPay,
  loading,
  keysAvailable,
  creditBalance,
}: Props) {
  const isCredit     = payMethod === 'credit';
  const waveOk       = keysAvailable?.wave ?? false;
  const omOk         = keysAvailable?.orange_money ?? false;
  const canAfford    = creditBalance >= plan.price;
  const isDisabled   = loading || (isCredit && !canAfford);
  const price        = formatPrice(plan.price);

  return (
    <View style={[s.footer, { paddingBottom: BOTTOM_PAD }]}>

      {/* Résumé forfait */}
      <View style={s.summary}>
        <Text style={s.sumLabel}>
          Forfait <Text style={s.sumBold}>{plan.label}</Text>
        </Text>
        <Text style={s.sumPrice}>{price}</Text>
      </View>

      {/* Solde crédit (visible quand crédit sélectionné) */}
      {isCredit && (
        <View style={s.balanceRow}>
          <Text style={s.balanceLabel}>Ton solde crédit</Text>
          <Text style={[s.balanceAmount, !canAfford && s.balanceLow]}>
            {formatPrice(creditBalance)}
          </Text>
        </View>
      )}

      {/* Sélecteur de méthode — 3 lignes radio */}
      <Text style={s.payLabel}>Mode de paiement</Text>
      <View style={s.payMethods}>

        {/* Crédit LASSI */}
        <TouchableOpacity
          style={[s.payRow, isCredit && s.payRowActive]}
          onPress={() => onMethodChange('credit')}
          activeOpacity={0.8}
        >
          <View style={[s.payRadio, isCredit && s.payRadioActive]}>
            {isCredit && <IcoCheck />}
          </View>
          <View style={s.payInfo}>
            <Text style={[s.payName, isCredit && s.payNameActive]}>Crédit LASSI</Text>
            <Text style={s.payDesc}>Déduction immédiate de ton solde</Text>
          </View>
          <Text style={[s.payPrice, isCredit && s.payPriceActive]}>{price}</Text>
        </TouchableOpacity>

        {/* Wave */}
        {WAVE_ENABLED && (
          <TouchableOpacity
            style={[s.payRow, payMethod === 'wave' && s.payRowActive, !waveOk && s.payRowDisabled]}
            onPress={() => { if (waveOk) onMethodChange('wave'); }}
            activeOpacity={waveOk ? 0.8 : 1}
          >
            <View style={[s.payRadio, payMethod === 'wave' && s.payRadioActive]}>
              {payMethod === 'wave' ? <IcoCheck /> : !waveOk ? <IcoLock /> : null}
            </View>
            <View style={s.payInfo}>
              <Text style={[s.payName, payMethod === 'wave' && s.payNameActive]}>Wave</Text>
              <Text style={s.payDesc}>{waveOk ? 'Paiement mobile sécurisé' : 'Bientôt disponible'}</Text>
            </View>
            <Text style={[s.payPrice, payMethod === 'wave' && s.payPriceActive]}>{price}</Text>
          </TouchableOpacity>
        )}

        {/* Orange Money */}
        <TouchableOpacity
          style={[s.payRow, payMethod === 'orange_money' && s.payRowActive, !omOk && s.payRowDisabled]}
          onPress={() => { if (omOk) onMethodChange('orange_money'); }}
          activeOpacity={omOk ? 0.8 : 1}
        >
          <View style={[s.payRadio, payMethod === 'orange_money' && s.payRadioActive]}>
            {payMethod === 'orange_money' ? <IcoCheck /> : !omOk ? <IcoLock /> : null}
          </View>
          <View style={s.payInfo}>
            <Text style={[s.payName, payMethod === 'orange_money' && s.payNameActive]}>Orange Money</Text>
            <Text style={s.payDesc}>{omOk ? 'Paiement mobile sécurisé' : 'Bientôt disponible'}</Text>
          </View>
          <Text style={[s.payPrice, payMethod === 'orange_money' && s.payPriceActive]}>{price}</Text>
        </TouchableOpacity>

      </View>

      {/* Bouton payer */}
      <TouchableOpacity
        style={[s.btn, isDisabled && (isCredit && !canAfford ? s.btnInsufficient : s.btnLoading)]}
        onPress={onPay}
        activeOpacity={0.85}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} size="small" />
        ) : isCredit && !canAfford ? (
          <>
            <IcoWallet muted />
            <Text style={s.btnInsufficientTxt}>Crédit insuffisant</Text>
          </>
        ) : (
          <>
            {isCredit ? <IcoWallet /> : <IcoCard />}
            <Text style={s.btnTxt}>
              {isCredit
                ? 'Payer avec mon crédit LASSI'
                : `Payer via ${payMethod === 'wave' ? 'Wave' : 'Orange Money'}`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {isCredit && !canAfford && (
        <Text style={s.hintTxt}>
          Il te manque {formatPrice(plan.price - creditBalance)} de crédit LASSI.
        </Text>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },

  // Résumé
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    fontSize: 20,
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
    paddingVertical: 9,
    marginBottom: 10,
  },
  balanceLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  balanceAmount: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  balanceLow: {
    color: colors.danger,
  },

  // Label section
  payLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 10,
  },

  // Lignes radio
  payMethods: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payRowActive: {
    backgroundColor: 'rgba(253,207,52,0.06)',
    borderBottomColor: colors.border,
  },
  payRowDisabled: {
    opacity: 0.45,
  },
  payRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRadioActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  payInfo: {
    flex: 1,
  },
  payName: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  payNameActive: {
    color: colors.white,
  },
  payDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  payPrice: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  payPriceActive: {
    color: colors.accent,
  },

  // Bouton payer
  btn: {
    height: 52,
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
    fontSize: 15,
  },
  btnInsufficientTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  hintTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
