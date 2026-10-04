import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  Linking, Alert, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { PayMethod } from '../../types/payment';
import { WAVE_ENABLED } from '../../config/features';
import useAuthStore from '../../store/authStore';
import * as beautyService from '../../services/beauty';
import { getPaymentMethodsByMerchant } from '../../services/shops';
import logger from '../../utils/logger';

const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO   = require('../../../assets/om.png');

// ─── Helpers date ──────────────────────────────────────────────────────────────

const DAYS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Icônes ────────────────────────────────────────────────────────────────────

const IcoClock = () => (
  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} strokeLinecap="round" />
  </Svg>
);

// ─── Méthode paiement ─────────────────────────────────────────────────────────

function MethodCard({ method, processing, onPay }: { method: PayMethod; processing: boolean; onPay: () => void }) {
  const label = method === 'wave' ? 'Wave' : 'Orange Money';
  const logo  = method === 'wave' ? WAVE_LOGO : OM_LOGO;
  return (
    <TouchableOpacity
      style={[styles.methodCard, processing && { opacity: 0.7 }]}
      onPress={onPay}
      activeOpacity={0.85}
      disabled={processing}
    >
      <View style={styles.methodLeft}>
        <Image source={logo} style={styles.methodLogo} resizeMode="cover" />
        <Text style={styles.methodLabel}>{label}</Text>
      </View>
      {processing
        ? <ActivityIndicator color={colors.accent} />
        : <Text style={styles.methodPayTxt}>Payer</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Attente paiement ─────────────────────────────────────────────────────────

function WaitingView({ method, total, verifying, onVerify, onBack }: {
  method: PayMethod; total: number; verifying: boolean; onVerify: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.waitRoot}>
      <View style={styles.waitCard}>
        <IcoClock />
        <Text style={styles.waitTitle}>En attente de paiement</Text>
        <Text style={styles.waitBody}>
          {'Complète le paiement de '}
          <Text style={styles.waitAmount}>{formatPrice(total)}</Text>
          {` dans ${method === 'wave' ? 'Wave' : 'Orange Money'}, puis reviens ici.`}
        </Text>
      </View>
      <TouchableOpacity style={[styles.verifyBtn, verifying && { opacity: 0.7 }]} onPress={onVerify} activeOpacity={0.85} disabled={verifying}>
        {verifying ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.verifyTxt}>J'ai payé — Vérifier ✓</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backLink}>← Annuler et revenir</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  prestataireId: string;
  prestataireName: string;
  serviceId: string;
  serviceNom: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  prixTotal: number;
  onBack: () => void;
  onSuccess: (receiptCode: string) => void;
}

type Stage = 'checkout' | 'waiting';

// ─── Écran ─────────────────────────────────────────────────────────────────────

export default function BeautyPaymentScreen({
  prestataireId, prestataireName,
  serviceId, serviceNom,
  dateReservation, heureDebut, heureFin,
  prixTotal, onBack, onSuccess,
}: Props) {
  const clientId     = useAuthStore(s => s.user?.id ?? '');
  const [stage, setStage]         = useState<Stage>('checkout');
  // Moyens de paiement acceptés par le prestataire (respecte son choix, comme les commandes)
  const [allowedMethods, setAllowedMethods] = useState<('wave' | 'om')[]>(['wave', 'om']);
  const merchantMethods = allowedMethods.filter((m): m is PayMethod => m !== 'wave' || WAVE_ENABLED);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const referenceRef    = useRef('');
  const reservationIdRef = useRef('');
  const processingRef   = useRef(false);
  const moyenRef        = useRef<'wave' | 'orange_money'>('wave');

  // Charge les moyens de paiement du prestataire + corrige la sélection
  useEffect(() => {
    let alive = true;
    getPaymentMethodsByMerchant(prestataireId)
      .then(methods => {
        if (!alive) return;
        setAllowedMethods(methods);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [prestataireId]);

  const handlePay = async (moyen: 'wave' | 'orange_money') => {
    if (processingRef.current || !clientId) return;
    moyenRef.current = moyen;
    processingRef.current = true;
    setProcessing(true);
    try {
      if (!reservationIdRef.current) {
        const resa = await beautyService.createBeautyPendingReservation({
          clientId,
          prestataireId,
          serviceId,
          date:       dateReservation,
          heureDebut,
          heureFin,
          prixTotal,
        });
        reservationIdRef.current = resa.id;
      }

      const session = await beautyService.createBeautyPaymentSession({
        reservationId: reservationIdRef.current,
        moyenPaiement: moyen,
      });
      referenceRef.current = session.reference;

      if (session.paymentUrl) {
        await Linking.openURL(session.paymentUrl);
      }
      setStage('waiting');
    } catch (err) {
      logger.warn('[BeautyPayment] handlePay:', err);
      const pgCode  = (err as { code?: string }).code ?? '';
      const anyMsg  = (err instanceof Error ? err.message : (err as { message?: string }).message ?? '').toLowerCase();
      const isExcl  = pgCode === '23P01' || anyMsg.includes('exclusion') || anyMsg.includes('overlap');
      if (isExcl) {
        Alert.alert('Créneau indisponible', "Ce créneau vient d'être réservé. Choisis un autre créneau.");
      } else {
        Alert.alert('Erreur', "Impossible d'initier la réservation. Réessaie.");
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (verifying || !clientId) return;
    setVerifying(true);
    try {
      const MAX_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 3000));
        const result = await beautyService.verifyBeautyPaymentById({
          reference:     referenceRef.current,
          reservationId: reservationIdRef.current,
          method:        moyenRef.current,
        });
        if (result.paid) {
          onSuccess(result.receiptCode ?? '');
          return;
        }
      }
      Alert.alert('Paiement non confirmé', "Le paiement n'est pas encore confirmé. Réessaie.");
    } catch (err) {
      logger.warn('[BeautyPayment] handleVerify:', err);
      Alert.alert('Erreur', 'Impossible de confirmer le paiement. Réessaie.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = useCallback(async () => {
    if (processingRef.current) return;
    if (reservationIdRef.current) {
      await beautyService.cancelBeautyPendingReservation(reservationIdRef.current).catch(() => {});
      reservationIdRef.current = '';
    }
    onBack();
  }, [onBack]);

  if (stage === 'waiting') {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.8}><IcoBack /></TouchableOpacity>
          <Text style={styles.topTitle}>Paiement en cours</Text>
        </View>
        <WaitingView method={moyenRef.current === 'wave' ? 'wave' : 'om'} total={prixTotal} verifying={verifying} onVerify={handleVerify} onBack={handleCancel} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.8}><IcoBack /></TouchableOpacity>
        <Text style={styles.topTitle}>Confirmer le rendez-vous</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.secLabel}>Votre rendez-vous</Text>
        <View style={styles.recapCard}>
          <Text style={styles.recapTerrain}>{serviceNom}</Text>
          <Text style={styles.recapPresta}>Chez {prestataireName}</Text>
          <View style={styles.recapDivider} />
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Date</Text>
            <Text style={styles.recapVal}>{formatDateFr(dateReservation)}</Text>
          </View>
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Créneau</Text>
            <Text style={styles.recapVal}>{heureDebut} → {heureFin}</Text>
          </View>
          <View style={styles.recapDivider} />
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Total</Text>
            <Text style={styles.recapTotal}>{formatPrice(prixTotal)}</Text>
          </View>
        </View>

        <Text style={styles.secLabel}>Mode de paiement</Text>
        {merchantMethods.includes('wave') && (
          <MethodCard method="wave" processing={processing} onPay={() => handlePay('wave')} />
        )}
        {merchantMethods.includes('om') && (
          <MethodCard method="om" processing={processing} onPay={() => handlePay('orange_money')} />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 10 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  secLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 10,
  },

  recapCard:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16 },
  recapTerrain: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  recapPresta:  { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  recapDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  recapRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recapKey:     { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapVal:     { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  recapTotal:   { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  methodCard:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, marginBottom: 10,
  },
  methodLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodLogo:    { width: 32, height: 32, borderRadius: 8 },
  methodLabel:   { color: colors.white, fontFamily: fonts.ui, fontSize: 15 },
  methodPayTxt:  { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },

  waitRoot: { flex: 1, paddingHorizontal: 24, paddingBottom: BOTTOM_PAD, alignItems: 'center', justifyContent: 'center', gap: 20 },
  waitCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 14 },
  waitTitle:  { color: colors.white, fontFamily: fonts.title, fontSize: 17, textAlign: 'center' },
  waitBody:   { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  waitAmount: { color: colors.accent, fontFamily: fonts.title },
  verifyBtn:  { width: '100%', height: 54, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  verifyTxt:  { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
  backLink:   { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
