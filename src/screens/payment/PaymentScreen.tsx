import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import PaymentHeader from '../../components/payment/PaymentHeader';
import OrderRecap from '../../components/payment/OrderRecap';
import PayMethodCard from '../../components/payment/PayMethodCard';
import DeepLinkNote from '../../components/payment/DeepLinkNote';
import PayFooter from '../../components/payment/PayFooter';
import ConfirmView from '../../components/payment/ConfirmView';
import { colors, fonts, radius } from '../../theme';
import { OrderInfo, PayMethod } from '../../types/payment';
import * as payService from '../../services/payment';
import { WAVE_ENABLED } from '../../config/features';
import logger from '../../utils/logger';
import { formatPrice } from '../../utils/format';

// ─── Label de section ────────────────────────────────────────────────────────

const SectionLabel = ({ label }: { label: string }) => <Text style={styles.secLabel}>{label}</Text>;

// ─── Écran d'attente après ouverture SenePay ─────────────────────────────────

function WaitingView({
  method,
  total,
  verifying,
  paymentUrl,
  qrCode,
  onVerify,
  onBack,
}: {
  method: PayMethod;
  total: number;
  verifying: boolean;
  paymentUrl: string;
  qrCode?: string;
  onVerify: () => void;
  onBack: () => void;
}) {
  const methodLabel = method === 'wave' ? 'Wave' : 'Orange Money';
  const hasQr = method === 'om' && !!qrCode && !paymentUrl;
  return (
    <View style={styles.waitRoot}>
      <View style={styles.waitCard}>
        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
          <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
          <Path d="M12 6v6l4 2" stroke={colors.accent} strokeLinecap="round" />
        </Svg>
        <Text style={styles.waitTitle}>En attente de paiement</Text>
        {hasQr ? (
          <>
            <Text style={styles.waitBody}>
              Scanne ce QR code avec l'app{' '}
              <Text style={styles.waitAmount}>Orange Money</Text>
              {' '}pour payer{' '}
              <Text style={styles.waitAmount}>{formatPrice(total)}</Text>.
            </Text>
            <Image
              source={{ uri: `data:image/png;base64,${qrCode}` }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </>
        ) : (
          <Text style={styles.waitBody}>
            {'Complète le paiement de '}
            <Text style={styles.waitAmount}>{formatPrice(total)}</Text>
            {` dans ${methodLabel}, puis reviens ici et appuie sur le bouton ci-dessous.`}
          </Text>
        )}
      </View>

      {!!paymentUrl && (
        <TouchableOpacity
          style={styles.reopenBtn}
          onPress={() => Linking.openURL(paymentUrl).catch(() => {})}
          activeOpacity={0.8}
        >
          <Text style={styles.reopenTxt}>↗ Rouvrir {methodLabel}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.verifyBtn, verifying && styles.verifyBtnLoading]}
        onPress={onVerify}
        activeOpacity={0.85}
        disabled={verifying}
      >
        {verifying ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.verifyTxt}>J'ai payé — Vérifier ✓</Text>
        )}
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
  order: OrderInfo;
  onBack: () => void;
  onSuccess: (ticketId: string) => void;
}

export default function PaymentScreen({ order, onBack, onSuccess }: Props) {
  const [stage, setStage] = useState<Stage>(
    order.paymentConfirmed ? 'confirm' : order.preInitiatedPiId ? 'waiting' : 'checkout',
  );
  const [method, setMethod] = useState<PayMethod>(
    WAVE_ENABLED ? (order.preMethod ?? 'wave') : 'om',
  );
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const referenceRef = useRef<string>(order.preInitiatedPiId ?? '');
  const processingRef = useRef(false);

  const [paymentUrl, setPaymentUrl] = useState<string>(order.paymentUrl ?? '');

  // Ouvre automatiquement l'app de paiement dès que l'écran d'attente est affiché.
  // En faisant l'ouverture ICI (pas dans CartScreen), LASSI est déjà au second plan
  // et Android ne lui redonne pas le focus — l'app OM reste visible.
  useEffect(() => {
    if (stage !== 'waiting' || !paymentUrl) return;
    const t = setTimeout(() => {
      Linking.openURL(paymentUrl).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // une seule fois au montage

  const handlePay = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const session = await payService.createPayment({
        ticketId: order.ticketId,
        amount: order.total,
        method,
        merchantName: order.shopName,
      });
      referenceRef.current = session.reference;

      // Mode simulation (pas de clés API Wave/OM) : vérification directe
      if (session.simulation) {
        const paid = await payService.verifyPayment({
          reference: session.reference,
          ticketId: order.ticketId,
          method,
        });
        if (paid) {
          setStage('confirm');
        } else {
          Alert.alert('Simulation', 'Paiement simulé non confirmé. Réessaie.');
        }
        return;
      }

      if (session.paymentUrl) {
        setPaymentUrl(session.paymentUrl);
        // canOpenURL retourne false sur Android 11+ pour les schemes non déclarés
        // (ex. orangemoney://) même si l'app est installée → on ouvre directement.
        Linking.openURL(session.paymentUrl).catch(() => {
          Alert.alert(
            'Ouverture impossible',
            `L'app ${method === 'om' ? 'Orange Money' : 'Wave'} n'est pas installée ou le lien est invalide.`,
          );
        });
      }
      setStage('waiting');
    } catch (err) {
      logger.warn('[PaymentScreen] handlePay:', err);
      Alert.alert('Erreur', "Impossible d'initier le paiement. Réessaie dans un instant.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (verifying || !referenceRef.current) return;
    setVerifying(true);
    try {
      const paid = await payService.verifyPayment({
        reference: referenceRef.current,
        ticketId: order.ticketId,
        method,
      });
      if (paid) {
        setStage('confirm');
      } else {
        Alert.alert(
          'Paiement introuvable',
          "Votre paiement n'a pas encore été détecté. Vérifiez que la transaction a bien été effectuée dans Orange Money, puis réessayez dans quelques instants.",
        );
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
        <ConfirmView order={order} method={method} onBackToChat={() => onSuccess(order.ticketId)} />
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
          paymentUrl={paymentUrl}
          qrCode={order.qrCode}
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
        {WAVE_ENABLED && (
          <PayMethodCard
            method="wave"
            selected={method === 'wave'}
            onSelect={() => setMethod('wave')}
          />
        )}
        <PayMethodCard method="om" selected={method === 'om'} onSelect={() => setMethod('om')} />

        <DeepLinkNote method={method} />
        <View style={{ height: 14 }} />
      </ScrollView>

      <PayFooter method={method} total={order.total} loading={processing} onPay={handlePay} />
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
  reopenBtn: {
    width: '100%',
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  reopenTxt: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  qrImage: {
    width: 190,
    height: 190,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
});
