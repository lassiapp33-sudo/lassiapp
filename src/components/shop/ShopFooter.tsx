import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoMic = () => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" stroke={colors.accent} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={colors.accent} />
    <Path d="M12 19v3" stroke={colors.accent} />
  </Svg>
);

const IcoCard = () => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={2} y={5} width={20} height={14} rx={2} stroke={colors.bg} />
    <Path d="M2 10h20" stroke={colors.bg} />
  </Svg>
);

const BOTTOM_EXTRA = Platform.OS === 'ios' ? 20 : 0;
export const FOOTER_HEIGHT = 88 + BOTTOM_EXTRA;

interface Props {
  total:      number;
  hasItems:   boolean;
  onChat?:     () => void;
  onCheckout?: () => void;
}

export default function ShopFooter({ total, hasItems, onChat, onCheckout }: Props) {
  return (
    <View style={styles.footer}>
      {/* Bouton Chat / Vocal — accès direct à la messagerie commerçant */}
      <TouchableOpacity style={styles.btnChat} onPress={onChat} activeOpacity={0.8}>
        <View style={styles.notifDot} />
        <IcoMic />
        <Text style={styles.chatLbl}>Chat / Vocal</Text>
      </TouchableOpacity>

      {/* Bouton Commander · 1 clic — deep-link Wave / Orange Money */}
      <TouchableOpacity
        style={[styles.btnPay, !hasItems && styles.btnPayDim]}
        onPress={onCheckout}
        activeOpacity={0.85}
      >
        <IcoCard />
        <View>
          <Text style={styles.payTxt}>
            {hasItems
              ? `Commander · ${total.toLocaleString('fr-FR')} F`
              : 'Commander'}
          </Text>
          <Text style={styles.paySubTxt}>Payer via Wave / OM</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  // Point rouge indiquant un message non lu
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
});
