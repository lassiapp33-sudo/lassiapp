import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Platform, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import DebtHeader    from '../../components/debts/DebtHeader';
import TotalCard     from '../../components/debts/TotalCard';
import FilterChips   from '../../components/debts/FilterChips';
import DebtorCard    from '../../components/debts/DebtorCard';
import AddDebtSheet, { ClientOption } from '../../components/debts/AddDebtSheet';
import { colors, fonts } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { DebtFilter, DebtStatus } from '../../types/debts';
import useDebtsStore from '../../store/debtsStore';
import useShopStore  from '../../store/shopStore';
import * as chatService  from '../../services/chat';
import * as debtsService from '../../services/debts';
import { IcoPlus, IcoClose, IcoSearch } from '../../components/icons';
import LoadingSpinner from '../../components/LoadingSpinner';

const URGENCY: Record<DebtStatus, number> = { late: 0, watch: 1, good: 2 };
const FAB_BOTTOM = Platform.OS === 'ios' ? 34 : 24;

const IcoX = () => <IcoClose size={16} color={colors.muted} />;

interface Props { onBack: () => void; }

export default function DebtsScreen({ onBack }: Props) {
  const shopId     = useShopStore(s => s.shopId);
  const debtors    = useDebtsStore(s => s.debtors);
  const loading    = useDebtsStore(s => s.loading);
  const addToDebt  = useDebtsStore(s => s.addToDebt);
  const loadDebts  = useDebtsStore(s => s.loadDebts);

  const [filter,       setFilter]       = useState<DebtFilter>('all');
  const [showSheet,    setShowSheet]    = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [convClients,  setConvClients]  = useState<ClientOption[]>([]);

  useEffect(() => {
    if (!shopId) return;
    loadDebts(shopId);
    // Charge les clients qui ont échangé des messages avec ce prestataire
    chatService.getMerchantConversations(shopId).then(async convs => {
      const profiles = await Promise.all(
        convs.map(c => chatService.getClientProfile(c.clientId).then(p => ({
          id:   c.clientId,
          name: p.name || 'Client',
        })))
      );
      setConvClients(
        profiles
          .filter(p => p.name && p.name !== 'Client')
          .map(p => ({
            id:         p.id,
            name:       p.name,
            initial:    p.name.charAt(0).toUpperCase(),
            isExisting: false,
          }))
      );
    }).catch(() => {});
  }, [shopId]);

  const q = searchQuery.trim().toLowerCase();
  const displayed = debtors
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);

  // Options combinées : débiteurs existants + clients des conversations pas encore débiteurs
  const existingNames = new Set(debtors.map(d => d.name.toLowerCase()));
  const existingOptions: ClientOption[] = debtors.map(d => ({
    id:         d.id,
    name:       d.name,
    initial:    d.initial,
    isExisting: true,
  }));
  const newOptions: ClientOption[] = convClients.filter(
    c => !existingNames.has(c.name.toLowerCase())
  );
  const clientOptions: ClientOption[] = [...existingOptions, ...newOptions];

  const handleAddDebt = async (option: ClientOption, amount: number) => {
    if (!shopId) return;
    if (option.isExisting) {
      addToDebt(option.id, amount);
    } else {
      // Nouveau client : créer la ligne debt puis ajouter le montant
      try {
        const newDebtor = await debtsService.addDebtor(shopId, option.name);
        await debtsService.addToDebt(newDebtor.id, amount);
        loadDebts(shopId);  // recharge depuis Supabase
      } catch {
        Alert.alert('Erreur', "Impossible d'enregistrer la dette. Réessaie.");
      }
    }
  };

  return (
    <LassiScreen
      header={
        <>
          <DebtHeader
            onBack={onBack}
            onSearch={() => {
              setShowSearch(v => !v);
              setSearchQuery('');
            }}
          />
          {showSearch && (
            <View style={styles.searchBar}>
              <IcoSearch />
              <TextInput
                style={styles.searchInput}
                placeholder="Chercher un client…"
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <IcoX />
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      }
    >

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TotalCard debtors={debtors} />
          <FilterChips active={filter} onChange={setFilter} />

          {displayed.length > 0 && (
            <Text style={styles.sec}>
              {displayed.length} client{displayed.length > 1 ? 's' : ''} · classé{displayed.length > 1 ? 's' : ''} par urgence
            </Text>
          )}

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
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: FAB_BOTTOM }]}
        onPress={() => setShowSheet(true)}
        activeOpacity={0.88}
      >
        <IcoPlus />
        <Text style={styles.fabTxt}>Ajouter une dette</Text>
      </TouchableOpacity>

      <AddDebtSheet
        visible={showSheet}
        clients={clientOptions}
        onSave={handleAddDebt}
        onClose={() => setShowSheet(false)}
      />
    </LassiScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: 4 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  sec: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

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
  fabTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14.5 },
});
