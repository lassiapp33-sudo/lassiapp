import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import DebtHeader   from '../../components/debts/DebtHeader';
import TotalCard    from '../../components/debts/TotalCard';
import FilterChips  from '../../components/debts/FilterChips';
import DebtorCard   from '../../components/debts/DebtorCard';
import AddDebtSheet from '../../components/debts/AddDebtSheet';
import { colors, fonts } from '../../theme';
import { DebtFilter, DebtStatus } from '../../types/debts';
import useDebtsStore from '../../store/debtsStore';

// Ordre de tri : rouge (urgence max) → orange → vert
const URGENCY: Record<DebtStatus, number> = { late: 0, watch: 1, good: 2 };

const FAB_BOTTOM = Platform.OS === 'ios' ? 34 : 24;

// ─── FAB ─────────────────────────────────────────────────────────────────────

const IcoPlus = () => (
  <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
    strokeWidth={2.4} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.bg} />
  </Svg>
);

// ─── Écran ────────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function DebtsScreen({ onBack }: Props) {
  const debtors    = useDebtsStore(s => s.debtors);
  const addToDebt  = useDebtsStore(s => s.addToDebt);

  const [filter,    setFilter]    = useState<DebtFilter>('all');
  const [showSheet, setShowSheet] = useState(false);

  // Filtre + tri par urgence
  const displayed = debtors
    .filter(d => filter === 'all' || d.status === filter)
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);

  // Ajout d'une dette depuis le bottom sheet → persiste dans le store
  const handleAddDebt = (debtorId: string, amount: number) => addToDebt(debtorId, amount);

  return (
    <View style={styles.root}>
      <DebtHeader onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte total dû */}
        <TotalCard debtors={debtors} />

        {/* Filtres par statut */}
        <FilterChips active={filter} onChange={setFilter} />

        {/* Label de section */}
        {displayed.length > 0 && (
          <Text style={styles.sec}>
            {displayed.length} client{displayed.length > 1 ? 's' : ''} · classé{displayed.length > 1 ? 's' : ''} par urgence
          </Text>
        )}

        {/* Liste des débiteurs ou état vide */}
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>Aucun client dans cette catégorie</Text>
          </View>
        ) : (
          displayed.map(debtor => (
            <DebtorCard key={debtor.id} debtor={debtor} />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB — Ajouter une dette (2 taps max) */}
      <TouchableOpacity
        style={[styles.fab, { bottom: FAB_BOTTOM }]}
        onPress={() => setShowSheet(true)}
        activeOpacity={0.88}
      >
        <IcoPlus />
        <Text style={styles.fabTxt}>Ajouter une dette</Text>
      </TouchableOpacity>

      {/* Bottom sheet d'ajout */}
      <AddDebtSheet
        visible={showSheet}
        debtors={debtors}
        onSave={handleAddDebt}
        onClose={() => setShowSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  content: { paddingTop: 4, flexGrow: 1 },

  sec: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  // Bouton flottant — accent bien visible en plein soleil
  fab: {
    position: 'absolute',
    right: 20,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabTxt: {
    color: colors.bg,
    fontFamily: fonts.titleXL,
    fontSize: 14.5,
  },
});
