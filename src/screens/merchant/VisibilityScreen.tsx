import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import VisibilityHeader from '../../components/visibility/VisibilityHeader';
import HeroCard         from '../../components/visibility/HeroCard';
import BenefitsList     from '../../components/visibility/BenefitsList';
import PlanCard         from '../../components/visibility/PlanCard';
import { Plan }         from '../../components/visibility/PlanCard';
import PayFooter        from '../../components/visibility/PayFooter';
import ActiveSubCard    from '../../components/visibility/ActiveSubCard';
import StatsGrid        from '../../components/visibility/StatsGrid';
import { colors, fonts, radius } from '../../theme';

// ─── Forfaits disponibles ─────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id:       '1m',
    label:    '1 mois',
    desc:     'Pour tester',
    price:    10000,
    perLabel: 'par mois',
    popular:  false,
  },
  {
    id:       '3m',
    label:    '3 mois',
    desc:     'Économise 6 000 F',
    price:    24000,
    perLabel: '8 000 F/mois',
    oldPrice: 30000,
    popular:  true,
  },
  {
    id:       '6m',
    label:    '6 mois',
    desc:     'Meilleure offre · −30%',
    price:    42000,
    perLabel: '7 000 F/mois',
    oldPrice: 60000,
    popular:  false,
  },
];

// ─── Sous-composant : carte de renouvellement ─────────────────────────────────

const IcoArrow = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.accent} />
  </Svg>
);

function RenewCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.renewCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
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

// ─── Écran principal ──────────────────────────────────────────────────────────

// L'écran bascule entre deux vues :
//   'subscribe'  → le commerçant n'a pas encore de forfait
//   'subscribed' → le commerçant est déjà abonné (stats + renouvellement)

type VisibilityView = 'subscribe' | 'subscribed';

interface Props {
  onBack:       () => void;
  initialView?: VisibilityView;  // permet de démarrer sur 'subscribed' pour le démo
}

export default function VisibilityScreen({ onBack, initialView = 'subscribe' }: Props) {
  const [view,       setView]       = useState<VisibilityView>(initialView);
  const [selectedId, setSelectedId] = useState('3m');     // populaire par défaut

  const selectedPlan = PLANS.find(p => p.id === selectedId) ?? PLANS[1];

  // Simule l'achat → passe en vue "abonné"
  const handlePay = () => setView('subscribed');

  // ── Vue "Déjà abonné" (stats + renouvellement) ────────────────────────────
  if (view === 'subscribed') {
    return (
      <View style={styles.root}>
        <VisibilityHeader title="Ma visibilité" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Carte forfait actif + barre de temps restant */}
          <ActiveSubCard
            planLabel="3 mois"
            daysLeft={47}
            expiryDate="21 juillet 2026"
            progress={0.62}         // 62% du forfait écoulé
          />

          {/* Label section stats */}
          <Text style={styles.secLabel}>Ce que ton forfait t'a rapporté</Text>

          {/* Grille 2×2 des retombées mesurées */}
          <StatsGrid />

          {/* Carte renouvellement */}
          <View style={styles.renewWrap}>
            <RenewCard onPress={() => setView('subscribe')} />
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Vue "Souscription" (choix du forfait) ────────────────────────────────
  return (
    <View style={styles.root}>
      <VisibilityHeader title="Booste ta visibilité" onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ① Hero "Sois vu partout à Dakar" */}
        <HeroCard />

        {/* ② Bénéfices avec icônes */}
        <BenefitsList />

        {/* ③ Forfaits sélectionnables */}
        <Text style={styles.secLabel}>Choisis ton forfait</Text>
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={plan.id === selectedId}
            onSelect={() => setSelectedId(plan.id)}
          />
        ))}

        <View style={{ height: 14 }} />
      </ScrollView>

      {/* ④ Footer fixe paiement */}
      <PayFooter plan={selectedPlan} onPay={handlePay} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },

  secLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },

  // Carte renouvellement (abonné)
  renewWrap: {
    paddingHorizontal: 18,
  },
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
});
