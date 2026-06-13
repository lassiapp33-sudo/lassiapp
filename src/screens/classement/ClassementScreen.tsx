import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import LassiScreen from '../../components/LassiScreen';
import { IcoBack } from '../../components/icons';
import PodiumClassement from '../../components/classement/PodiumClassement';
import ListeClassement from '../../components/classement/ListeClassement';
import RecompensesMondial from '../../components/classement/RecompensesMondial';
import RecompensesSousCategorie from '../../components/classement/RecompensesSousCategorie';
import {
  getClassementSousCategorie,
  getClassementMondial,
  getClassementQuartiers,
  getClassementClients,
  getPeriodeSemaine,
  getPeriodeMois,
  ClassementEntry,
} from '../../services/classementService';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
import { getErrorMessage, notifyError } from '../../utils/errorUtils';

type TabKey = 'categorie' | 'mondial' | 'quartier' | 'clients';

interface Props {
  /** 'prestataire' : Ma catégorie (hebdo) + Mondial. 'client' : Mon quartier + Top clients (mensuels). */
  variant: 'prestataire' | 'client';
  onBack: () => void;
}

export default function ClassementScreen({ variant, onBack }: Props) {
  const userId = useAuthStore(s => s.user?.id);
  const sousCategorie = useShopStore(s => s.context.subcategories[0]);

  const [onglet, setOnglet] = useState<TabKey>(
    variant === 'prestataire' ? (sousCategorie ? 'categorie' : 'mondial') : 'quartier',
  );
  const [entries, setEntries] = useState<ClassementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: ClassementEntry[];
      if (onglet === 'categorie' && sousCategorie) {
        data = await getClassementSousCategorie(sousCategorie, getPeriodeSemaine());
      } else if (onglet === 'mondial') {
        data = await getClassementMondial(getPeriodeMois(), 0, 40);
      } else if (onglet === 'quartier') {
        data = await getClassementQuartiers(getPeriodeMois());
      } else {
        data = await getClassementClients(getPeriodeMois());
      }
      setEntries(data);
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger le classement'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [onglet, sousCategorie]);

  useEffect(() => {
    load();
  }, [load]);

  const top3 = entries.slice(0, 3);
  const reste = entries.slice(3);
  const avatarVariant = variant === 'prestataire' ? 'shop' : 'user';

  const tabs: { key: TabKey; label: string }[] =
    variant === 'prestataire'
      ? [
          ...(sousCategorie ? [{ key: 'categorie' as TabKey, label: 'Ma catégorie' }] : []),
          { key: 'mondial' as TabKey, label: '🌍 Mondial' },
        ]
      : [
          { key: 'quartier' as TabKey, label: '📍 Mon quartier' },
          { key: 'clients' as TabKey, label: '🏆 Top clients' },
        ];

  const periodeLabel = onglet === 'categorie' ? '📅 Cette semaine' : '📅 Ce mois-ci';

  const hint =
    onglet === 'categorie'
      ? '🏅 Le Top 3 gagne le podium VIP cette semaine !'
      : onglet === 'mondial'
        ? '👑 Le Top 5 mondial débloque "Offre du Quartier" + récompenses !'
        : onglet === 'quartier'
          ? '🏅 Le quartier en tête fait la fierté de tous ses commerçants !'
          : '🎖️ Le client n°1 du mois reçoit le badge Supporter n°1 !';

  if (loading) {
    return (
      <LassiScreen header={<Header onBack={onBack} />} hideTopFade>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </LassiScreen>
    );
  }

  return (
    <LassiScreen header={<Header onBack={onBack} />} hideTopFade>
      <ListeClassement
        entries={reste}
        monId={userId}
        variant={avatarVariant}
        ListHeaderComponent={
          <View>
            {tabs.length > 1 && (
              <View style={styles.tabs}>
                {tabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, onglet === tab.key && styles.tabActive]}
                    onPress={() => setOnglet(tab.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabText, onglet === tab.key && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.periode}>{periodeLabel}</Text>

            {entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTxt}>Aucun classement disponible pour le moment.</Text>
              </View>
            ) : (
              <PodiumClassement top3={top3} variant={avatarVariant} />
            )}

            {onglet === 'categorie' && <RecompensesSousCategorie />}
            {onglet === 'mondial' && <RecompensesMondial />}
          </View>
        }
        ListFooterComponent={entries.length > 0 ? <Text style={styles.hint}>{hint}</Text> : null}
      />
    </LassiScreen>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={[styles.head, { paddingTop: TOP_INSET + 4 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={styles.headTitle}>🏆 Classement</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
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
    flexShrink: 0,
  },
  headTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 22 },

  tabs: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  tabTextActive: { color: colors.bg },

  periode: { color: colors.muted, fontSize: 13, marginBottom: 8 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  hint: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 18,
  },
});
