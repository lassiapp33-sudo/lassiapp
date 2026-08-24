import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { PayMethod } from '../../types/payment';
import { WAVE_ENABLED } from '../../config/features';
import useAuthStore from '../../store/authStore';
import * as terrainsService from '../../services/terrains';
import logger from '../../utils/logger';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClock = () => (
  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} strokeLinecap="round" />
  </Svg>
);

// ─── Carte méthode de paiement ────────────────────────────────────────────────

// Logos partenaires intégrés tels quels — ne pas modifier les images
const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO = require('../../../assets/om.png');

function MethodCard({
  method,
  selected,
  onSelect,
}: {
  method: PayMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = method === 'wave' ? 'Wave' : 'Orange Money';
  const logo = method === 'wave' ? WAVE_LOGO : OM_LOGO;
  return (
    <TouchableOpacity
      style={[styles.methodCard, selected && styles.methodCardOn]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={styles.methodLeft}>
        <Image source={logo} style={styles.methodLogo} resizeMode="cover" />
        <Text style={[styles.methodLabel, selected && styles.methodLabelOn]}>{label}</Text>
      </View>
      <View style={[styles.methodRadio, selected && styles.methodRadioOn]}>
        {selected && <View style={styles.methodRadioDot} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Récapitulatif réservation ────────────────────────────────────────────────

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Écran d'attente ─────────────────────────────────────────────────────────

function WaitingView({
  method,
  total,
  verifying,
  onVerify,
  onBack,
}: {
  method: PayMethod;
  total: number;
  verifying: boolean;
  onVerify: () => void;
  onBack: () => void;
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
      <TouchableOpacity
        style={[styles.verifyBtn, verifying && { opacity: 0.7 }]}
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  terrainId: string;
  terrainNom: string;
  prestataireId: string;
  prestataireName: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  prixTotal: number;
  onBack: () => void;
  onSuccess: (receiptCode: string) => void;
}

type Stage = 'checkout' | 'waiting' | 'done';

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainPaymentScreen({
  terrainId,
  terrainNom,
  prestataireId,
  prestataireName,
  dateReservation,
  heureDebut,
  heureFin,
  dureeHeures,
  prixTotal,
  onBack,
  onSuccess,
}: Props) {
  const clientId = useAuthStore(s => s.user?.id ?? '');
  const [stage, setStage] = useState<Stage>('checkout');
  const [method, setMethod] = useState<PayMethod>(WAVE_ENABLED ? 'wave' : 'om');
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const referenceRef = useRef('');
  const reservationIdRef = useRef('');
  // useRef anti-double-tap : se met à jour immédiatement (vs useState stale en closure)
  const processingRef = useRef(false);

  const moyenPaiement = method === 'wave' ? 'wave' : 'orange_money' as const;

  const handlePay = async () => {
    if (processingRef.current || !clientId) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      // 1. Pré-créer la réservation en_attente (bloque le créneau dès maintenant)
      if (!reservationIdRef.current) {
        const resa = await terrainsService.createPendingReservation({
          clientId,
          terrainId,
          prestataireId,
          date: dateReservation,
          heureDebut,
          heureFin,
          dureeHeures,
          prixTotal,
        });
        reservationIdRef.current = resa.id;
      }

      // 2. Initier le paiement (montant chargé côté serveur depuis la DB)
      const session = await terrainsService.createTerrainPaymentSession({
        reservationId: reservationIdRef.current,
        moyenPaiement,
      });
      referenceRef.current = session.reference;

      // 3. Ouvrir l'app de paiement (null en simulation → on passe directement à waiting)
      if (session.paymentUrl) {
        await Linking.openURL(session.paymentUrl);
      }
      setStage('waiting');
    } catch (err) {
      logger.warn('[TerrainPayment] handlePay:', err);
      // PostgrestError (depuis supabase.insert) n'est pas une instance d'Error —
      // il faut lire .code et .message directement.
      const pgCode = (err as { code?: string }).code ?? '';
      const anyMsg = (err instanceof Error ? err.message : (err as { message?: string }).message ?? '').toLowerCase();
      const isExclusionErr =
        pgCode === '23P01' ||
        anyMsg.includes('exclusion') ||
        anyMsg.includes('overlap') ||
        anyMsg.includes('exclude');
      if (isExclusionErr) {
        Alert.alert('Créneau indisponible', "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisis un autre créneau.");
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
      // Retry up to 3 times with 3s delay — covers the OM/Wave processing window
      const MAX_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 3000));
        const result = await terrainsService.verifyTerrainPaymentById({
          reference:     referenceRef.current,
          reservationId: reservationIdRef.current,
          method:        moyenPaiement,
        });
        if (result.paid) {
          onSuccess(result.receiptCode ?? '');
          return;
        }
      }
      Alert.alert(
        'Paiement non confirmé',
        "Le paiement n'est pas encore confirmé. Attends quelques secondes et réessaie.",
      );
    } catch (err) {
      logger.warn('[TerrainPayment] handleVerify:', err);
      Alert.alert('Erreur', 'Impossible de confirmer le paiement. Réessaie.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = useCallback(async () => {
    // Ne pas annuler si un paiement est en cours (race condition)
    if (processingRef.current) return;
    if (reservationIdRef.current) {
      await terrainsService.cancelPendingReservation(reservationIdRef.current).catch(() => {});
      reservationIdRef.current = '';
    }
    onBack();
  }, [onBack]);

  if (stage === 'waiting') {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.8}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Paiement en cours</Text>
        </View>
        <WaitingView
          method={method}
          total={prixTotal}
          verifying={verifying}
          onVerify={handleVerify}
          onBack={handleCancel}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Confirmer la réservation</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Récapitulatif */}
        <Text style={styles.secLabel}>Votre réservation</Text>
        <View style={styles.recapCard}>
          <Text style={styles.recapTerrain}>{terrainNom}</Text>
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
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Durée</Text>
            <Text style={styles.recapVal}>{dureeHeures}h</Text>
          </View>
          <View style={styles.recapDivider} />
          <View style={styles.recapRow}>
            <Text style={styles.recapKey}>Total</Text>
            <Text style={styles.recapTotal}>{formatPrice(prixTotal)}</Text>
          </View>
        </View>

        {/* Méthode de paiement */}
        <Text style={styles.secLabel}>Mode de paiement</Text>
        {WAVE_ENABLED && <MethodCard method="wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />}
        <MethodCard method="om" selected={method === 'om'} onSelect={() => setMethod('om')} />

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, processing && { opacity: 0.7 }]}
          onPress={handlePay}
          activeOpacity={0.85}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.payTxt}>Payer {formatPrice(prixTotal)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 10 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  secLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },

  recapCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  recapTerrain: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  recapPresta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  recapDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recapKey: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapVal: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  recapTotal: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
  },
  methodCardOn: { borderColor: colors.accent },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodLogo: { width: 32, height: 32, borderRadius: 8 },
  methodLabel: { color: colors.white, fontFamily: fonts.ui, fontSize: 15 },
  methodLabelOn: { color: colors.accent },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRadioOn: { borderColor: colors.accent },
  methodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: BOTTOM_PAD,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  payBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },

  // Waiting
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
  waitTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17, textAlign: 'center' },
  waitBody: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  waitAmount: { color: colors.accent, fontFamily: fonts.title },
  verifyBtn: {
    width: '100%',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
  backLink: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
});
