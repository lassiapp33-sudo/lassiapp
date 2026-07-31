import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, TOP_INSET } from '../theme';
import { VipCategorie, VipListeItem, VIP_CATEGORIE_LABELS } from '../types/vip';
import { getVipListe } from '../services/vip';

type Filtre = 'all' | VipCategorie;

const FILTRES: { id: Filtre; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'restauration', label: 'Restauration' },
  { id: 'musculation_fitness', label: 'Fitness' },
  { id: 'boulangerie_patisserie', label: 'Boulangerie' },
  { id: 'beaute_tressage', label: 'Beauté' },
  { id: 'coiffure', label: 'Coiffure' },
];

interface Props {
  onBack: () => void;
  onShopPress: (shopId: string, shopName: string) => void;
}

function MonogrammeVip({ initiale }: { initiale: string }) {
  return (
    <View style={styles.monogramme}>
      <Text style={styles.monogrammeTxt}>{initiale.toUpperCase()}</Text>
    </View>
  );
}

function CarteListe({
  item,
  onPress,
}: {
  item: VipListeItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.carte} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.carteLeft}>
        <MonogrammeVip initiale={item.initiale} />
      </View>
      <View style={styles.carteBody}>
        <View style={styles.carteRow}>
          <Text style={styles.nomAffiche} numberOfLines={1}>{item.nomAffiche}</Text>
          <View style={[styles.statutBadge, item.estOuvert ? styles.ouvert : styles.ferme]}>
            <Text style={styles.statutTxt}>{item.estOuvert ? 'Ouvert' : 'Fermé'}</Text>
          </View>
        </View>
        <Text style={styles.categorieTxt}>{VIP_CATEGORIE_LABELS[item.categorie]}</Text>
        {item.baseline ? (
          <Text style={styles.baseline} numberOfLines={2}>{item.baseline}</Text>
        ) : null}
        {item.adresseCourte ? (
          <Text style={styles.adresse} numberOfLines={1}>{item.adresseCourte}</Text>
        ) : null}
      </View>
      <Text style={styles.fleche}>›</Text>
    </TouchableOpacity>
  );
}

export default function VipListeScreen({ onBack, onShopPress }: Props) {
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [liste, setListe] = useState<VipListeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async (f: Filtre) => {
    setLoading(true);
    const res = await getVipListe(f === 'all' ? undefined : f);
    setListe(res);
    setLoading(false);
  }, []);

  useEffect(() => { charger(filtre); }, [filtre, charger]);

  return (
    <View style={styles.screen}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.retour} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.retourTxt}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.titreBadge}>5 ÉTOILES</Text>
          <Text style={styles.titreH1}>LASSI</Text>
        </View>
        <View style={styles.retourSpacer} />
      </View>

      {/* Filtres catégories */}
      <View style={styles.filtresRow}>
        {FILTRES.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filtreChip, filtre === f.id && styles.filtreChipActif]}
            onPress={() => setFiltre(f.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filtreTxt, filtre === f.id && styles.filtreTxtActif]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color='#C9A227' />
        </View>
      ) : liste.length === 0 ? (
        <View style={styles.vide}>
          <Text style={styles.videTxt}>Aucun établissement 5 Étoiles dans cette catégorie pour l'instant.</Text>
        </View>
      ) : (
        <FlatList
          data={liste}
          keyExtractor={item => item.shopId}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CarteListe
              item={item}
              onPress={() => onShopPress(item.shopId, item.nomAffiche)}
            />
          )}
        />
      )}
    </View>
  );
}

const OR_LASSI = '#C9A227';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0C1018',
  },
  header: {
    paddingTop: TOP_INSET,
    paddingBottom: 12,
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,162,39,0.2)',
    backgroundColor: '#0C1018',
  },
  retour: {
    width: 36,
    alignItems: 'flex-start',
  },
  retourSpacer: {
    width: 36,
  },
  retourTxt: {
    color: OR_LASSI,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.title,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  titreBadge: {
    color: OR_LASSI,
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 4,
  },
  titreH1: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 22,
    letterSpacing: 6,
    marginTop: 2,
  },
  filtresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.screen,
    paddingVertical: 12,
  },
  filtreChip: {
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filtreChipActif: {
    borderColor: OR_LASSI,
    backgroundColor: 'rgba(201,162,39,0.12)',
  },
  filtreTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  filtreTxtActif: {
    color: OR_LASSI,
    fontFamily: fonts.ui,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  videTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 22,
  },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.screen,
    marginBottom: 12,
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    borderRadius: 12,
    padding: 14,
  },
  carteLeft: {
    flexShrink: 0,
  },
  monogramme: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: OR_LASSI,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogrammeTxt: {
    color: OR_LASSI,
    fontFamily: fonts.title,
    fontSize: 20,
    lineHeight: 24,
  },
  carteBody: {
    flex: 1,
  },
  carteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  nomAffiche: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 15,
    flex: 1,
  },
  statutBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  ouvert: { backgroundColor: 'rgba(34,197,94,0.15)' },
  ferme:  { backgroundColor: 'rgba(255,255,255,0.06)' },
  statutTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  categorieTxt: {
    color: OR_LASSI,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  baseline: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  adresse: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  fleche: {
    color: 'rgba(201,162,39,0.5)',
    fontSize: 22,
    lineHeight: 26,
    flexShrink: 0,
  },
});
