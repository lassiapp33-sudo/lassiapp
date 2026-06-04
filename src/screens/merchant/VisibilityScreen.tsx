import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import VisibilityHeader from '../../components/visibility/VisibilityHeader';
import HeroCard from '../../components/visibility/HeroCard';
import BenefitsList from '../../components/visibility/BenefitsList';
import PlanCard from '../../components/visibility/PlanCard';
import PayFooter, { PayFooterUnavailable } from '../../components/visibility/PayFooter';
import ActiveSubCard, { computeSubCardProps } from '../../components/visibility/ActiveSubCard';
import StatsGrid from '../../components/visibility/StatsGrid';
import { colors, fonts, radius } from '../../theme';
import useShopStore from '../../store/shopStore';
import {
  VisibilityPlan,
  ActiveSub,
  PayMethod,
  getVisibilityPlans,
  getActiveSub,
  createVisibilityPayment,
  verifyVisibilityPayment,
  checkPaymentAvailability,
} from '../../services/visibilityPayment';

// ─── Sous-composant renouvellement ────────────────────────────────────────────

const IcoArrow = () => (
  <Svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.accent} />
  </Svg>
);

function RenewCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.renewCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.renewInfo}>
        <Text style={styles.renewTitle}>Renouveler à l'avance</Text>
        <Text style={styles.renewDesc}>Garde ta place sans interruption</Text>
      </View>
      <View style={styles.renewAction}>
        <Text style={styles.renewActionTxt}>Gérer</Text>
        <IcoArrow />
      </View>
    </TouchableOpacity>
  );
}

// ─── Bandeau "paiement en attente de confirmation" ────────────────────────────

function PendingPaymentBanner({ onVerify, loading }: { onVerify: () => void; loading: boolean }) {
  return (
    <View style={styles.pendingBanner}>
      <Text style={styles.pendingTxt}>
        Paiement en attente — appuie sur le bouton après avoir payé dans l'app.
      </Text>
      <TouchableOpacity
        style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
        onPress={onVerify}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.verifyBtnTxt}>
          {loading ? 'Vérification…' : "J'ai payé — vérifier"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Types d'état de paiement ─────────────────────────────────────────────────

type PayState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'pending'; subscriptionId: string; paymentUrl: string }
  | { type: 'verifying' }
  | { type: 'error'; message: string };

type VisibilityView = 'subscribe' | 'subscribed';

interface Props {
  onBack: () => void;
  initialView?: VisibilityView;
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function VisibilityScreen({ onBack, initialView = 'subscribe' }: Props) {
  const shopId = useShopStore(s => s.shopId);

  const [view, setView] = useState<VisibilityView>(initialView);
  const [plans, setPlans] = useState<VisibilityPlan[]>([]);
  const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
  const [selectedId, setSelectedId] = useState('3m');
  const [payMethod, setPayMethod] = useState<PayMethod>('wave');
  const [payState, setPayState] = useState<PayState>({ type: 'idle' });
  const [initLoading, setInitLoading] = useState(true);
  const [keysAvailable, setKeysAvailable] = useState<{
    wave: boolean;
    orange_money: boolean;
  } | null>(null);

  const selectedPlan = plans.find(p => p.id === selectedId) ?? plans[1] ?? null;

  // ── Chargement initial : plans + abonnement actif ─────────────────────────
  const init = useCallback(async () => {
    setInitLoading(true);
    try {
      const [loadedPlans, sub, keys] = await Promise.all([
        getVisibilityPlans(),
        shopId ? getActiveSub(shopId) : Promise.resolve(null),
        checkPaymentAvailability(),
      ]);
      setPlans(loadedPlans);
      setKeysAvailable(keys);
      if (sub) {
        setActiveSub(sub);
        setView('subscribed');
      }
    } catch {
      // Silencieux : la liste de fallback est dans getVisibilityPlans
      setKeysAvailable({ wave: false, orange_money: false });
    } finally {
      setInitLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    init();
  }, [init]);

  // ── Lancer le paiement ────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedPlan || !shopId) return;

    setPayState({ type: 'loading' });
    try {
      const result = await createVisibilityPayment({
        planId: selectedPlan.id,
        payMethod,
      });

      if (result.status === 'awaiting_keys') {
        // Clés API non encore configurées → basculer le footer sur "Bientôt disponible"
        setPayState({ type: 'idle' });
        setKeysAvailable(prev => ({
          ...(prev ?? { wave: false, orange_money: false }),
          [payMethod]: false,
        }));
        return;
      }

      // Paiement initié → ouvrir l'app Wave/OM
      setPayState({
        type: 'pending',
        subscriptionId: result.subscriptionId,
        paymentUrl: result.paymentUrl,
      });

      if (result.paymentUrl) {
        const canOpen = await Linking.canOpenURL(result.paymentUrl);
        if (canOpen) {
          await Linking.openURL(result.paymentUrl);
        } else {
          Alert.alert(
            'Application introuvable',
            `Installe ${payMethod === 'wave' ? 'Wave' : 'Orange Money'} pour continuer le paiement.`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      setPayState({ type: 'error', message: msg });
      Alert.alert('Erreur de paiement', msg);
    }
  };

  // ── Vérifier le paiement après retour de l'app Wave/OM ───────────────────
  const handleVerify = async () => {
    if (payState.type !== 'pending') return;
    const { subscriptionId } = payState;

    setPayState({ type: 'verifying' });
    try {
      const result = await verifyVisibilityPayment(subscriptionId);

      if (result.paid) {
        // Recharger l'abonnement depuis la DB pour avoir les vraies données
        const sub = shopId ? await getActiveSub(shopId) : null;
        setActiveSub(sub);
        setPayState({ type: 'idle' });
        setView('subscribed');
      } else if (result.status === 'awaiting_keys') {
        setPayState({ type: 'idle' });
        Alert.alert('Configuration en cours', 'Les clés API ne sont pas encore configurées.');
      } else {
        setPayState({ type: 'pending', subscriptionId, paymentUrl: '' });
        Alert.alert(
          'Paiement non confirmé',
          "Nous n'avons pas encore reçu la confirmation. Réessaie dans quelques secondes.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de vérification';
      setPayState({ type: 'idle' });
      Alert.alert('Erreur', msg);
    }
  };

  // ── Vue "Déjà abonné" ─────────────────────────────────────────────────────
  if (view === 'subscribed' && activeSub) {
    const cardProps = computeSubCardProps({
      planLabel: activeSub.planLabel,
      startedAt: activeSub.startedAt,
      expiresAt: activeSub.expiresAt,
    });

    return (
      <View style={styles.root}>
        <VisibilityHeader title="Ma visibilité" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ActiveSubCard
            planLabel={cardProps.planLabel}
            daysLeft={cardProps.daysLeft}
            expiryDate={cardProps.expiryDate}
            progress={cardProps.progress}
          />

          <Text style={styles.secLabel}>Ce que ton forfait t'a rapporté</Text>
          <StatsGrid />

          <View style={styles.renewWrap}>
            <RenewCard onPress={() => setView('subscribe')} />
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Vue "Souscription" ────────────────────────────────────────────────────
  if (initLoading || !selectedPlan) {
    return (
      <View style={styles.root}>
        <VisibilityHeader title="Booste ta visibilité" onBack={onBack} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingTxt}>Chargement…</Text>
        </View>
      </View>
    );
  }

  const isPending = payState.type === 'pending';
  const isVerifying = payState.type === 'verifying';
  const isLoading = payState.type === 'loading';

  return (
    <View style={styles.root}>
      <VisibilityHeader title="Booste ta visibilité" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HeroCard />
        <BenefitsList />

        <Text style={styles.secLabel}>Choisis ton forfait</Text>
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={plan.id === selectedId}
            onSelect={() => setSelectedId(plan.id)}
          />
        ))}

        {/* Bandeau affiché quand un paiement est en attente */}
        {isPending && (
          <View style={styles.bannerWrap}>
            <PendingPaymentBanner onVerify={handleVerify} loading={isVerifying} />
          </View>
        )}

        <View style={{ height: 14 }} />
      </ScrollView>

      {/* Footer : indisponible si clés non configurées, masqué si paiement en attente */}
      {!isPending &&
        !isVerifying &&
        (keysAvailable?.[payMethod] ? (
          <PayFooter
            plan={selectedPlan}
            payMethod={payMethod}
            onMethodChange={setPayMethod}
            onPay={handlePay}
            loading={isLoading}
          />
        ) : (
          <PayFooterUnavailable plan={selectedPlan} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },

  secLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  renewWrap: { paddingHorizontal: 18 },
  renewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: 16,
  },
  renewInfo: { flex: 1 },
  renewTitle: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 14,
  },
  renewDesc: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  renewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  renewActionTxt: {
    color: colors.accent,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Bandeau paiement en attente
  bannerWrap: { paddingHorizontal: 18, marginTop: 4 },
  pendingBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
  },
  pendingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 10,
  },
  verifyBtn: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },

  // Chargement initial
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
