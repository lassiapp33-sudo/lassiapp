import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import { IncomingOrder } from '../../types/orders';
import { IcoClose } from '../icons';

const BOTTOM_PAD = Platform.OS === 'ios' ? 28 : 14;

const REASONS = [
  'Rupture de stock',
  'Commerce fermé',
  'Article indisponible',
  'Délai trop long',
];

interface Props {
  visible:  boolean;
  order:    IncomingOrder | null;
  onRefuse: (reason: string) => void;
  onClose:  () => void;
}

export default function RefuseSheet({ visible, order, onRefuse, onClose }: Props) {
  const [selected, setSelected] = useState<string>(REASONS[0]);

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
        <View style={styles.grab} />

        {/* Mini carte client */}
        <View style={styles.clientCard}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarTxt}>{order.initial}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{order.clientName}</Text>
            <Text style={styles.clientSub} numberOfLines={1}>
              {order.orderId} · {order.total.toLocaleString('fr-FR')} F
            </Text>
          </View>
        </View>

        {/* Titre */}
        <Text style={styles.title}>Pourquoi refuser ?</Text>
        <Text style={styles.sub}>Le client sera informé du refus.</Text>

        {/* Raisons */}
        <View style={styles.reasons}>
          {REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, selected === r && styles.chipSel]}
              onPress={() => setSelected(r)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipTxt, selected === r && styles.chipTxtSel]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Boutons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.refuseBtn}
            onPress={() => onRefuse(selected)}
            activeOpacity={0.85}
          >
            <IcoClose color={colors.muted} />
            <Text style={styles.refuseTxt}>Refuser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,24,.65)',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clientAvatarTxt: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  clientInfo: { flex: 1, minWidth: 0 },
  clientName: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  clientSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    marginTop: 1,
  },

  title: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 19,
    marginBottom: 4,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginBottom: 18,
  },

  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSel: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(224,122,122,.1)',
  },
  chipTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  chipTxtSel: {
    color: colors.danger,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  refuseBtn: {
    flex: 1,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(224,122,122,.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  refuseTxt: {
    color: colors.danger,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
