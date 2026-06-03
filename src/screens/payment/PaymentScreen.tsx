import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import PaymentHeader from '../../components/payment/PaymentHeader';
import OrderRecap    from '../../components/payment/OrderRecap';
import PayMethodCard from '../../components/payment/PayMethodCard';
import DeepLinkNote  from '../../components/payment/DeepLinkNote';
import PayFooter     from '../../components/payment/PayFooter';
import ConfirmView   from '../../components/payment/ConfirmView';
import { colors, fonts, radius } from '../../theme';
import { OrderInfo, PayMethod } from '../../types/payment';
import * as payService from '../../services/payment';
import logger          from '../../utils/logger';
import { formatPrice } from '../../utils/format';

// ─── Label de section ────────────────────────────────────────────────────────

const SectionLabel = ({ label }: { label: string }) => (
  <Text style={styles.secLabel}>{label}</Text>
);

// ─── Écran d'attente après ouverture SenePay ─────────────────────────────────

function WaitingView({
  method, total, verifying, onVerify, onBack,
}: {
  method:    PayMethod;
  total:     number;
  verifying: boolean;
  onVerify:  () => void;
  onBack:    () => void;
}) {
  const methodLabel = method === 'wave' ? 'Wave' : 'Orange Money';
  return (
    <View style={styles.waitRoot}>
      <View style={styles.waitCard}>
        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
          <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
          <Path d="M12 6v6l4 2" stroke={colors.accent} strokeLinecap="round" />
        </Svg>
        <Text style={styles.waitTitle}>En attente de paiement</Text>
        <Text style={styles.waitBody}>
          {'Complète le paiement de '}
          <Text style={styles.waitAmount}>{formatPrice(total)}</Text>
          {` dans ${methodLabel}, puis reviens ici et appuie sur le bouton ci-dessous.`}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.verifyBtn, verifying && styles.verifyBtnLoading]}
        onPress={onVerify}
        activeOpacity={0.85}
        disabled={verifying}
      >
        {verifying
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.verifyTxt}>J'ai payé — Vérifier ✓</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backLink}>← Annuler et revenir</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

type Stage = 'checkout' | 'waiting' | 'confirm';

interface Props {
  order:     OrderInfo;
  onBack:    () => void;
  onSuccess: (ticketId: string) => void;
}

export default function PaymentScreen({ order, onBack, onSuccess }: Props) {
  const [stage,      setStage]      = useState<Stage>('checkout');
  const [method,     setMethod]     = useState<PayMethod>('wave');
  const [processing, setProcessing] = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const referenceRef = useRef<string>('');

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const session = await payService.createPayment({
        ticketId:     order.ticketId,
        amount:       order.total,
        method,
        merchantName: order.shopName,
      });
      referenceRef.current = session.reference;
      await Linking.openURL(session.paymentUrl);
      setStage('waiting');
    } catch (err) {
      logger.warn('[PaymentScreen] handlePay:', err);
      Alert.alert('Erreur', "Impossible d'initier le paiement. Réessaie dans un instant.");
    } finally {
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const paid = await payService.verifyPayment({
        reference: referenceRef.current,
        ticketId:  order.ticketId,
        method,
      });
      if (paid) {
        setStage('confirm');
      } else {
        Alert.alert('Paiement non trouvé', "Le paiement n'est pas encore confirmé. Attends quelques secondes et réessaie.");
      }
    } catch (err) {
      logger.warn('[PaymentScreen] handleVerify:', err);
      Alert.alert('Erreur', 'Impossible de vérifier le paiement. Réessaie.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Confirmation ──────────────────────────────────────────────────────────
  if (stage === 'confirm') {
    return (
      <View style={styles.root}>
        <ConfirmView
          order={order}
          method={method}
          onBackToChat={() => onSuccess(order.ticketId)}
        />
      </View>
    );
  }

  // ── Attente paiement ──────────────────────────────────────────────────────
  if (stage === 'waiting') {
    return (
      <View style={styles.root}>
        <PaymentHeader title="Paiement en cours" onBack={onBack} />
        <WaitingView
          method={method}
          total={order.total}
          verifying={verifying}
          onVerify={handleVerify}
          onBack={onBack}
        />
      </View>
    );
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <PaymentHeader title="Paiement" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel label="Ta commande" />
        <OrderRecap order={order} />

        <SectionLabel label="Mode de paiement" />
        <PayMethodCard method="wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />
        <PayMethodCard method="om"   selected={method === 'om'}   onSelect={() => setMethod('om')} />

        <DeepLinkNote method={method} />
        <View style={{ height: 14 }} />
      </ScrollView>

      <PayFooter
        method={method}
        total={order.total}
        loading={processing}
        onPay={handlePay}
      />
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexGrow: 1,
  },
  secLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },

  // ── Waiting view ──────────────────────────────────────────────────────────
  waitRoot: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: BOTTOM_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  waitCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  waitTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
    textAlign: 'center',
  },
  waitBody: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  waitAmount: {
    color: colors.accent,
    fontFamily: fonts.title,
  },
  verifyBtn: {
    width: '100%',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnLoading: { opacity: 0.7 },
  verifyTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  backLink: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
});
