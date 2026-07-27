import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

const IcoMic = () => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={colors.accent} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.accent} />
    <Path d="M12 19v3" stroke={colors.accent} />
  </Svg>
);

const IcoCard = () => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const BOTTOM_EXTRA = Platform.OS === 'ios' ? 34 : 0;
export const FOOTER_HEIGHT = 88 + BOTTOM_EXTRA;

// Labels du bouton principal selon le type de vitrine
const LABELS: Record<string, { main: string; sub: string }> = {
  products: { main: 'Commander', sub: 'Payer via Wave / OM' },
  services: { main: 'Réserver', sub: 'Confirmer la réservation' },
  memberships: { main: 'Réserver', sub: 'Voir les formules' },
};

interface Props {
  total: number;
  hasItems: boolean;
  shopType?: 'products' | 'services' | 'memberships' | 'terrains';
  isOpen?: boolean;
  nextChange?: string;
  onChat?: () => void;
  onCheckout?: () => void;
}

export default function ShopFooter({
  total,
  hasItems,
  shopType = 'products',
  isOpen = true,
  nextChange = '',
  onChat,
  onCheckout,
}: Props) {
  const { main, sub } = LABELS[shopType] ?? LABELS.products;

  const mainLabel = shopType === 'products' && hasItems ? `${main} · ${formatPrice(total)}` : main;

  const handleCheckout = () => {
    if (!isOpen) {
      const message = nextChange
        ? `Cette boutique est actuellement fermée.\n${nextChange}`
        : 'Cette boutique est actuellement fermée. Revenez plus tard.';
      Alert.alert('Boutique fermée', message, [{ text: 'OK' }]);
      return;
    }
    onCheckout?.();
  };

  return (
    <View style={styles.footer}>
      {/* Bouton Chat / Vocal */}
      <TouchableOpacity style={styles.btnChat} onPress={onChat} activeOpacity={0.8}>
        <View style={styles.notifDot} />
        <IcoMic />
        <Text style={styles.chatLbl}>Chat / Vocal</Text>
      </TouchableOpacity>

      {/* Bouton d'action principal — libellé adapté au type */}
      <TouchableOpacity
        style={[
          styles.btnPay,
          !isOpen && styles.btnPayClosed,
          isOpen && !hasItems && shopType === 'products' && styles.btnPayDim,
        ]}
        onPress={handleCheckout}
        activeOpacity={0.85}
      >
        <IcoCard />
        <View>
          <Text style={[styles.payTxt, !isOpen && styles.payTxtClosed]}>{!isOpen ? 'Boutique fermée' : mainLabel}</Text>
          <Text style={[styles.paySubTxt, !isOpen && styles.paySubTxtClosed]}>{!isOpen ? (nextChange || 'Indisponible') : sub}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    height: FOOTER_HEIGHT,
    backgroundColor: 'rgba(20, 21, 42, 0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_EXTRA,
  },
  btnChat: {
    width: 62,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.danger,
  },
  chatLbl: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 8,
  },
  btnPay: {
    flex: 1,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  btnPayDim: { opacity: 0.55 },
  btnPayClosed: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    opacity: 0.85,
  },
  payTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  paySubTxt: {
    color: colors.bg,
    fontFamily: fonts.ui,
    fontSize: 9.5,
    opacity: 0.7,
    marginTop: -1,
  },
  payTxtClosed: {
    color: colors.danger,
  },
  paySubTxtClosed: {
    color: colors.danger,
  },
});
