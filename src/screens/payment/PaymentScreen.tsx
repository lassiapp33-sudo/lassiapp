import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

import PaymentHeader from '../../components/payment/PaymentHeader';
import OrderRecap    from '../../components/payment/OrderRecap';
import PayMethodCard from '../../components/payment/PayMethodCard';
import DeepLinkNote  from '../../components/payment/DeepLinkNote';
import PayFooter     from '../../components/payment/PayFooter';
import ConfirmView   from '../../components/payment/ConfirmView';
import { colors, fonts } from '../../theme';
import { OrderInfo, PayMethod } from '../../types/payment';

// ─── Label de section ────────────────────────────────────────────────────────

const SectionLabel = ({ label }: { label: string }) => (
  <Text style={styles.secLabel}>{label}</Text>
);

// ─── Écran ────────────────────────────────────────────────────────────────────

type Stage = 'checkout' | 'confirm';

interface Props {
  order:     OrderInfo;
  onBack:    () => void;
  onSuccess: (ticketId: string) => void;
}

export default function PaymentScreen({ order, onBack, onSuccess }: Props) {
  const [stage,      setStage]      = useState<Stage>('checkout');
  const [method,     setMethod]     = useState<PayMethod>('wave');
  const [processing, setProcessing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage si le composant est démonté pendant le traitement
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // TODO Phase 3 (backend) : Linking.openURL(`wave://pay?amount=...`)
  const handlePay = () => {
    if (processing) return;
    setProcessing(true);
    timerRef.current = setTimeout(() => {
      setProcessing(false);
      setStage('confirm');
    }, 1800);
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
});
