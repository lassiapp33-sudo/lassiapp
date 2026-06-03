import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { MerchantPayment, PaymentStatus } from '../../types/merchantPayments';
import { formatPrice, formatDateTime } from '../../utils/format';

const IcoWave = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M2 12c2-4 4-6 6-6s4 6 6 6 4-6 6-6" stroke="#1DC8F2" />
  </Svg>
);

const IcoOM = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2}>
    <Circle cx={12} cy={12} r={9} stroke="#F87315" />
    <Path d="M12 8v8M8 12h8" stroke="#F87315" strokeLinecap="round" />
  </Svg>
);

const STATUS_CFG: Record<PaymentStatus, { dot: string; text: string; bg: string; label: string }> = {
  pending:  { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)'  },
  success:  { label: 'Reçu',       dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)'  },
  failed:   { label: 'Échoué',     dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
  refunded: { label: 'Remboursé',  dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
};

export interface MerchantPaymentCardProps {
  payment:   MerchantPayment;
  onReceipt: () => void;
}

export function MerchantPaymentCard({ payment, onReceipt }: MerchantPaymentCardProps) {
  const cfg = STATUS_CFG[payment.status];

  return (
    <View style={s.wrap}>
      <View style={s.top}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{payment.clientName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.client} numberOfLines={1}>{payment.clientName}</Text>
          <Text style={s.date}>{formatDateTime(payment.createdAt)}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <View style={[s.dot, { backgroundColor: cfg.dot }]} />
          <Text style={[s.badgeTxt, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      {payment.items.length > 0 && (
        <Text style={s.items} numberOfLines={1}>
          {payment.items.map(i =>
            i.qty && i.qty > 1 ? `${i.qty}× ${i.name}` : i.name
          ).join(', ')}
        </Text>
      )}

      <View style={s.divider} />

      <View style={s.footer}>
        <Text style={s.amount}>{formatPrice(payment.amount)}</Text>
        <View style={s.method}>
          {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
          <Text style={s.methodTxt}>{payment.method === 'wave' ? 'Wave' : 'OM'}</Text>
        </View>
        {payment.reference && (
          <Text style={s.ref} numberOfLines={1}>#{payment.reference.slice(-6).toUpperCase()}</Text>
        )}
        {payment.status === 'success' && (
          <TouchableOpacity style={s.receiptBtn} onPress={onReceipt} activeOpacity={0.8}>
            <Text style={s.receiptTxt}>Voir le reçu</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 14,
  },
  top:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(253,207,52,0.12)',
    borderWidth: 1, borderColor: 'rgba(253,207,52,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },
  info:   { flex: 1, minWidth: 0 },
  client: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  date:   { color: colors.muted, fontFamily: fonts.body,  fontSize: 10.5, marginTop: 1 },
  badge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, flexShrink: 0 },
  dot:    { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontFamily: fonts.ui, fontSize: 10.5 },
  items:  { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, marginBottom: 8 },
  divider:{ height: 1, backgroundColor: colors.border, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15, flex: 1 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  methodTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  ref:    { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  receiptBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  receiptTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
});
