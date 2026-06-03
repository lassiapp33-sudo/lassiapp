import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { MerchantPayment, PaymentStatus } from '../../types/merchantPayments';
import { formatPrice, formatDateTime } from '../../utils/format';
import { IcoClose } from '../icons';

const IcoCheck = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.success} />
  </Svg>
);

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

const STATUS_CFG: Record<PaymentStatus, { label: string; dot: string; text: string; bg: string }> = {
  pending:  { label: 'En attente', dot: '#FDCF34', text: '#FDCF34', bg: 'rgba(253,207,52,0.12)'  },
  success:  { label: 'Reçu',       dot: '#5FD38A', text: '#5FD38A', bg: 'rgba(95,211,138,0.12)'  },
  failed:   { label: 'Échoué',     dot: '#E07A7A', text: '#E07A7A', bg: 'rgba(224,122,122,0.12)' },
  refunded: { label: 'Remboursé',  dot: '#60A5FA', text: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
};

export interface PaymentReceiptModalProps {
  payment: MerchantPayment | null;
  onClose: () => void;
}

export function PaymentReceiptModal({ payment, onClose }: PaymentReceiptModalProps) {
  if (!payment) return null;
  const cfg = STATUS_CFG[payment.status];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>Reçu de paiement</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.closeBtn}>
              <IcoClose />
            </TouchableOpacity>
          </View>

          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[s.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[s.statusTxt, { color: cfg.text }]}>{cfg.label}</Text>
            {payment.status === 'success' && <IcoCheck />}
          </View>

          <View style={s.row}>
            <Text style={s.rowLabel}>Client</Text>
            <Text style={s.rowValue}>{payment.clientName}</Text>
          </View>
          {payment.clientPhone && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Téléphone</Text>
              <Text style={s.rowValue}>{payment.clientPhone}</Text>
            </View>
          )}

          {payment.items.length > 0 && (
            <View style={s.itemsSection}>
              <Text style={s.rowLabel}>Articles</Text>
              {payment.items.map((item, i) => (
                <View key={i} style={s.itemRow}>
                  <Text style={s.itemName}>
                    {item.qty && item.qty > 1 ? `${item.qty}× ` : ''}{item.name}
                  </Text>
                  {item.price != null && (
                    <Text style={s.itemPrice}>{formatPrice(item.price)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={s.divider} />

          <View style={s.row}>
            <Text style={s.rowLabel}>Montant reçu</Text>
            <Text style={s.amountValue}>{formatPrice(payment.amount)}</Text>
          </View>

          <View style={s.row}>
            <Text style={s.rowLabel}>Moyen de paiement</Text>
            <View style={s.methodRow}>
              {payment.method === 'wave' ? <IcoWave /> : <IcoOM />}
              <Text style={s.rowValue}>{payment.method === 'wave' ? 'Wave' : 'Orange Money'}</Text>
            </View>
          </View>

          {payment.reference && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Référence</Text>
              <Text style={[s.rowValue, s.reference]}>{payment.reference}</Text>
            </View>
          )}

          <View style={s.row}>
            <Text style={s.rowLabel}>Date</Text>
            <Text style={s.rowValue}>{formatDateTime(payment.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end', padding: 16, paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  title:    { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: radius.pill, marginBottom: 16,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontFamily: fonts.title, fontSize: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel:    { color: colors.muted,  fontFamily: fonts.body,    fontSize: 12 },
  rowValue:    { color: colors.white,  fontFamily: fonts.ui,      fontSize: 13, flex: 1, textAlign: 'right' },
  amountValue: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },
  reference:   { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  methodRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemsSection:{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName:    { color: '#cfd0e0', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  itemPrice:   { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  divider:     { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
