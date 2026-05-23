import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { PayMethod } from '../../types/payment';

const IcoCard = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const IcoLock = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Rect x={3} y={11} width={18} height={11} rx={2} stroke={colors.success} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={colors.success} />
  </Svg>
);

const BOTTOM_PAD = Platform.OS === 'ios' ? 20 : 8;

const METHOD_LABEL: Record<PayMethod, string> = {
  wave: 'Wave',
  om:   'Orange Money',
};

interface Props {
  method:  PayMethod;
  total:   number;
  loading: boolean;
  onPay:   () => void;
}

export default function PayFooter({ method, total, loading, onPay }: Props) {
  return (
    <View style={[styles.footer, { paddingBottom: BOTTOM_PAD }]}>
      {/* Bouton payer */}
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
            <Text style={styles.btnTxt}>
              Payer {total.toLocaleString('fr-FR')} F via {METHOD_LABEL[method]}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Mention sécurité */}
      <View style={styles.secRow}>
        <IcoLock />
        <Text style={styles.secTxt}>
          Paiement sécurisé · LASSİ ne stocke aucune donnée bancaire
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  btn: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  btnLoading: { opacity: 0.7 },
  btnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 16,
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 11,
  },
  secTxt: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
});
