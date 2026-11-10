import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';
import { getRefundInfo, processRefund, RefundInfo } from '../../services/orders';

interface Props {
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'loading' | 'info' | 'confirming' | 'done' | 'error';

const IcoClose = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.muted} />
  </Svg>
);

const IcoCheck = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

export default function RefundSheet({ visible, orderId, onClose, onSuccess }: Props) {
  const [step, setStep]     = useState<Step>('loading');
  const [info, setInfo]     = useState<RefundInfo | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStep('loading');
    setInfo(null);
    setErrMsg('');
    getRefundInfo(orderId)
      .then(d => {
        if (!d.alreadyRefunded && !d.clientPhone) {
          setErrMsg('Numéro du client introuvable pour ce remboursement.');
          setStep('error');
          return;
        }
        setInfo(d);
        setStep(d.alreadyRefunded ? 'done' : 'info');
      })
      .catch(e => { setErrMsg(e.message); setStep('error'); });
  }, [visible, orderId]);

  const handleConfirm = async () => {
    setStep('confirming');
    try {
      await processRefund(orderId);
      setStep('done');
      setTimeout(onSuccess, 1200);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setStep('error');
    }
  };


  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={s.overlay}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Rembourser le client</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <IcoClose />
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {step === 'loading' && (
            <View style={s.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}

          {/* Info — confirmation avant remboursement automatique */}
          {step === 'info' && info && (
            <>
              <View style={s.infoBox}>
                <Text style={s.infoLabel}>Remboursement client</Text>
                <Text style={s.infoAmount}>{formatPrice(info.montantPrestataire + info.commissionLassi)}</Text>
                <Text style={s.infoSub}>à rembourser à</Text>
                <Text style={s.infoPhone}>{info.clientPhone}</Text>
              </View>

              <Text style={s.hint}>
                LASSI envoie le remboursement complet automatiquement via {info.payMethod === 'wave' ? 'Wave' : 'Orange Money'}.
              </Text>

              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <IcoCheck />
                <Text style={s.confirmTxt}>Confirmer le remboursement</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Confirming */}
          {step === 'confirming' && (
            <View style={s.center}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={s.pendingTxt}>LASSI envoie la commission au client…</Text>
            </View>
          )}

          {/* Done */}
          {step === 'done' && (
            <View style={s.center}>
              <View style={s.successCircle}>
                <IcoCheck />
              </View>
              <Text style={s.successTxt}>Remboursement effectué</Text>
              <Text style={s.successSub}>Le client a reçu une notification.</Text>
            </View>
          )}

          {/* Error */}
          {step === 'error' && (
            <View style={s.center}>
              <Text style={s.errTxt}>Erreur</Text>
              <Text style={s.errSub}>{errMsg}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => { setStep('loading'); setInfo(null); getRefundInfo(orderId).then(d => { setInfo(d); setStep('info'); }).catch(e => { setErrMsg(e.message); setStep('error'); }); }}>
                <Text style={s.retryTxt}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 36,
    minHeight: 240,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  infoBox: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  infoLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 4,
  },
  infoAmount: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  infoSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 6,
  },
  infoPhone: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    marginTop: 2,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 17,
  },
  confirmBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmTxt: {
    color: '#06301a',
    fontFamily: fonts.title,
    fontSize: 15,
  },
  pendingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  successSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  errTxt: {
    color: '#ff5a5a',
    fontFamily: fonts.title,
    fontSize: 15,
  },
  errSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryTxt: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
