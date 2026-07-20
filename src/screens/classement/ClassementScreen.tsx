import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getClassementLiveSousCategorie,
  getClassementLiveMondial,
  getClassementLiveQuartiers,
  getClassementLiveClients,
  getPeriodeSemaine,
  getPeriodeMois,
  clearClassementCache,
  ClassementEntry,
} from '../../services/classementService';
import { supabase } from '../../lib/supabase';
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
  useShopStore(s => s.shopId); // conservé pour déclencher le re-render si la boutique change
  const subcategories = useShopStore(s => s.context.subcategories);
  const shopCategory = useShopStore(s => s.context.category);
  // Clé de classement : sous-catégorie si dispo, sinon catégorie principale
  const classeKey = subcategories[0] ?? shopCategory;
  // prestataire_id et client_id dans classements = profiles.id = userId
  const monId = userId;

  const [onglet, setOnglet] = useState<TabKey>(
    variant === 'prestataire' ? 'categorie' : 'quartier',
  );
  const [entries, setEntries] = useState<ClassementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: ClassementEntry[];
      if (onglet === 'categorie' && classeKey) {
        data = await getClassementSousCategorie(classeKey, getPeriodeSemaine());
        // Fallback live si pg_cron n'a pas encore tourné pour cette semaine
        if (data.length === 0) data = await getClassementLiveSousCategorie(classeKey);
      } else if (onglet === 'mondial') {
        data = await getClassementMondial(getPeriodeMois(), 0, 40);
        // Fallback live si pg_cron n'a pas encore tourné pour ce mois
        if (data.length === 0) data = await getClassementLiveMondial();
      } else if (onglet === 'quartier') {
        data = await getClassementQuartiers(getPeriodeMois());
        if (data.length === 0) data = await getClassementLiveQuartiers();
      } else {
        data = await getClassementClients(getPeriodeMois());
        if (data.length === 0) data = await getClassementLiveClients();
      }
      setEntries(data);
    } catch (e) {
      notifyError(getErrorMessage(e, 'Impossible de charger le classement'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [onglet, classeKey]);

  // Garde une référence stable vers load() pour le channel Realtime
  useEffect(() => { loadRef.current = load; }, [load]);

  // Vide le cache et recharge à chaque ouverture de l'écran
  useEffect(() => {
    clearClassementCache();
    load();
  }, [load]);

  // Realtime : recharge automatiquement quand pg_cron écrit un nouveau snapshot
  useEffect(() => {
    const channel = supabase
      .channel('classements-snapshot')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'classements' }, () => {
        clearClassementCache();
        loadRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // une seule souscription par montage

  const top3 = entries.slice(0, 3);
  const reste = entries.slice(3);
  const avatarVariant = (variant === 'prestataire' || onglet === 'mondial') ? 'shop' : 'user';

  const tabs: { key: TabKey; label: string }[] =
    variant === 'prestataire'
      ? [
          { key: 'categorie' as TabKey, label: 'Ma catégorie' },
          { key: 'mondial' as TabKey, label: '🏆 National' },
        ]
      : [
          { key: 'quartier' as TabKey, label: '📍 Mon quartier' },
          { key: 'clients' as TabKey, label: '🏆 Top clients' },
          { key: 'mondial' as TabKey, label: '🌍 Top national' },
        ];

  const periodeLabel = onglet === 'categorie' ? '📅 Cette semaine' : '📅 Ce mois-ci';

  const hint =
    onglet === 'categorie'
      ? '🏅 Le Top 3 gagne le podium VIP cette semaine !'
      : onglet === 'mondial'
        ? variant === 'prestataire'
          ? '👑 Le Top 5 national débloque "Offre du Quartier" + récompenses !'
          : '👑 Les meilleurs prestataires du Sénégal ce mois-ci !'
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
        monId={monId}
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
            {onglet === 'mondial' && variant === 'prestataire' && <RecompensesMondial />}
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
  tabText: { color: colors.white, fontFamily: fonts.ui, fontSize: 12.5, textAlign: 'center' },
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
