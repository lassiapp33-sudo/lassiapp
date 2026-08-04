import React, { useState, useRef } from 'react';
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
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { calculerPrixClient } from '../../config/payment';
import { PayMethod } from '../../types/payment';
import { FitnessOffre } from '../../services/fitnessAbonnements';
import { supabase } from '../../lib/supabase';

// ─── Logos partenaires ────────────────────────────────────────────────────────
const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO   = require('../../../assets/om.png');

const SUPABASE_URL   = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const ANON_KEY       = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée — reconnecte-toi');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    apikey: ANON_KEY,
  };
}

// ─── Icône horloge ───────────────────────────────────────────────────────────
const IcoClock = () => (
  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} stroke={colors.accent} />
    <Path d="M12 6v6l4 2" stroke={colors.accent} strokeLinecap="round" />
  </Svg>
);

// ─── Carte méthode de paiement ────────────────────────────────────────────────
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
  const logo  = method === 'wave' ? WAVE_LOGO : OM_LOGO;
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

// ─── Vue en attente de paiement ───────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  offre: FitnessOffre;
  fitnessName: string;
  onBack: () => void;
  onSuccess: () => void;
}

type Stage = 'checkout' | 'waiting';

// ─── Écran ────────────────────────────────────────────────────────────────────
export default function FitnessAbonnementPaymentScreen({
  offre,
  fitnessName,
  onBack,
  onSuccess,
}: Props) {
  const [stage,      setStage]      = useState<Stage>('checkout');
  const [method,     setMethod]     = useState<PayMethod>('wave');
  const [processing, setProcessing] = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const piIdRef = useRef('');
  const processingRef = useRef(false);

  const prixClient = calculerPrixClient(offre.prix);

  const handlePay = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/create-fitness-abonnement-payment`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          offreId:   offre.id,
          payMethod: method === 'om' ? 'orange_money' : method,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Erreur paiement');

      piIdRef.current = data.piId;

      // Mode simulation → abonnement créé directement
      if (data.mode === 'simulation') {
        onSuccess();
        return;
      }

      // Production → ouvrir Wave/OM
      if (data.redirectUrl) {
        Linking.openURL(data.redirectUrl).catch(() => {});
      }
      setStage('waiting');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      Alert.alert('Erreur', msg);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (verifying || !piIdRef.current) return;
    setVerifying(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/verify-fitness-payment`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ piId: piIdRef.current }),
      });
      const data = await res.json();
      if (data.paid) {
        onSuccess();
      } else {
        const msg = data.info
          ?? "Le paiement n'a pas encore été reçu. Vérifie dans Wave ou Orange Money, puis réessaie dans quelques instants.";
        Alert.alert('Paiement non confirmé', msg);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de vérifier le paiement. Réessaie.');
    } finally {
      setVerifying(false);
    }
  };

  if (stage === 'waiting') {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <IcoBack />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abonnement fitness</Text>
        </View>
        <WaitingView
          method={method}
          total={prixClient}
          verifying={verifying}
          onVerify={handleVerify}
          onBack={onBack}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement fitness</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Récapitulatif offre */}
        <View style={styles.recap}>
          <Text style={styles.recapLabel}>Fitness</Text>
          <Text style={styles.recapValue}>{fitnessName}</Text>

          <Text style={[styles.recapLabel, { marginTop: 12 }]}>Abonnement</Text>
          <Text style={styles.recapValue}>{offre.nom}</Text>

          {offre.description ? (
            <>
              <Text style={[styles.recapLabel, { marginTop: 12 }]}>Description</Text>
              <Text style={styles.recapDesc}>{offre.description}</Text>
            </>
          ) : null}

          <Text style={[styles.recapLabel, { marginTop: 12 }]}>Durée</Text>
          <Text style={styles.recapValue}>{offre.dureeJours} jours</Text>

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalAmount}>{formatPrice(prixClient)}</Text>
          </View>

        </View>

        {/* Choix méthode */}
        <Text style={styles.sectionTitle}>Moyen de paiement</Text>
        <MethodCard method="wave" selected={method === 'wave'} onSelect={() => setMethod('wave')} />
        <MethodCard method="om"   selected={method === 'om'}   onSelect={() => setMethod('om')} />

        {/* Bouton payer */}
        <TouchableOpacity
          style={[styles.payBtn, processing && { opacity: 0.7 }]}
          onPress={handlePay}
          activeOpacity={0.88}
          disabled={processing}
        >
          {processing
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.payTxt}>
                Payer {formatPrice(prixClient)} avec {method === 'wave' ? 'Wave' : 'Orange Money'}
              </Text>
          }
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: TOP_INSET + 12,
    paddingBottom: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 18 },

  recap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 22,
  },
  recapLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  recapValue: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  recapDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  totalAmount: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 20,
  },
  commissionNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 4,
  },

  sectionTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 14,
    marginBottom: 10,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  methodCardOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(253,207,52,.06)',
  },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodLogo: { width: 38, height: 38, borderRadius: 8 },
  methodLabel: {
    color: colors.muted,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  methodLabelOn: { color: colors.white },
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

  payBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },

  // Stage waiting
  waitRoot: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  waitCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  waitTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  waitBody: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  waitAmount: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
  },
  verifyBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  verifyTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  backLink: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
});
