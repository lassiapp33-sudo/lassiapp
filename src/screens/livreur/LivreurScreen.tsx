import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Linking,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import {
  getLivraisonsDisponibles, getMesLivraisons,
  accepterLivraison, terminerLivraison, Livraison,
} from '../../services/livraisons';

interface Props {
  onLogout: () => void;
}

export default function LivreurScreen({ onLogout }: Props) {
  const [dispos, setDispos] = useState<Livraison[]>([]);
  const [miennes, setMiennes] = useState<Livraison[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [onglet, setOnglet] = useState<'dispo' | 'encours'>('dispo');

  const charger = useCallback(async () => {
    setRefreshing(true);
    const [d, m] = await Promise.all([getLivraisonsDisponibles(), getMesLivraisons()]);
    setDispos(d);
    setMiennes(m);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const handleAccepter = useCallback(async (id: string) => {
    const r = await accepterLivraison(id);
    if (!r.success) { Alert.alert('Oups', r.error); charger(); return; }
    Alert.alert('Acceptée', 'La livraison est à vous. Bonne route !');
    charger();
    setOnglet('encours');
  }, [charger]);

  const handleTerminer = useCallback((id: string) => {
    Alert.alert('Confirmer', 'Confirmer que la livraison est bien arrivée ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui, terminée',
        onPress: async () => {
          const r = await terminerLivraison(id);
          if (!r.success) { Alert.alert('Erreur', r.error); return; }
          Alert.alert('Terminée', 'Livraison confirmée. Merci !');
          charger();
        },
      },
    ]);
  }, [charger]);

  const liste = useMemo(
    () => onglet === 'dispo' ? dispos : miennes,
    [onglet, dispos, miennes],
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Espace Livreur</Text>
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
          <Text style={s.logoutTxt}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, onglet === 'dispo' && s.tabActive]}
          onPress={() => setOnglet('dispo')}
          activeOpacity={0.8}
        >
          <Text style={[s.tabText, onglet === 'dispo' && s.tabTextActive]}>
            Disponibles ({dispos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, onglet === 'encours' && s.tabActive]}
          onPress={() => setOnglet('encours')}
          activeOpacity={0.8}
        >
          <Text style={[s.tabText, onglet === 'encours' && s.tabTextActive]}>
            En cours ({miennes.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={liste}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={charger} tintColor={colors.accent} />
        }
        contentContainerStyle={s.list}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={5}
        initialNumToRender={8}
        ListEmptyComponent={
          <Text style={s.empty}>
            {onglet === 'dispo'
              ? 'Aucune livraison disponible pour le moment.'
              : 'Aucune livraison en cours.'}
          </Text>
        }
        renderItem={({ item }) => <LivraisonCard
          item={item}
          onglet={onglet}
          onAccepter={handleAccepter}
          onTerminer={handleTerminer}
        />}
      />
    </View>
  );
}

interface CardProps {
  item: Livraison;
  onglet: 'dispo' | 'encours';
  onAccepter: (id: string) => void;
  onTerminer: (id: string) => void;
}

const LivraisonCard = memo(function LivraisonCard({ item, onglet, onAccepter, onTerminer }: CardProps) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.prix}>{item.prix_livraison.toLocaleString()} F</Text>
        <Text style={s.distance}>{Number(item.distance_km).toFixed(1)} km</Text>
      </View>

      <View style={s.trajet}>
        <Text style={s.pointLabel}>Départ</Text>
        <Text style={s.pointValue}>{item.depart_label}</Text>
      </View>
      <View style={s.trajet}>
        <Text style={s.pointLabel}>Arrivée</Text>
        <Text style={s.pointValue}>{item.arrivee_label}</Text>
      </View>

      {onglet === 'encours' && item.contact_tel ? (
        <TouchableOpacity
          style={s.contactBtn}
          onPress={() => Linking.openURL(`tel:${item.contact_tel}`)}
          activeOpacity={0.8}
        >
          <Text style={s.contactText}>
            Appeler {item.contact_nom ?? 'le client'} · {item.contact_tel}
          </Text>
        </TouchableOpacity>
      ) : null}

      {onglet === 'dispo' ? (
        <TouchableOpacity style={s.btn} onPress={() => onAccepter(item.id)} activeOpacity={0.85}>
          <Text style={s.btnText}>Accepter la livraison</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[s.btn, s.btnDone]} onPress={() => onTerminer(item.id)} activeOpacity={0.85}>
          <Text style={s.btnText}>Livraison terminée</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: TOP_INSET + 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },

  tabs: { flexDirection: 'row', gap: 10, padding: 16 },
  tab: {
    flex: 1, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.surface, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  tabTextActive: { color: colors.bg },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 20 },
  distance: { color: colors.muted, fontFamily: fonts.label, fontSize: 13 },

  trajet: { marginBottom: 8 },
  pointLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 11 },
  pointValue: { color: colors.white, fontFamily: fonts.body, fontSize: 14, marginTop: 2 },

  contactBtn: {
    backgroundColor: colors.bg, borderRadius: radius.sm,
    padding: 10, marginTop: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  contactText: { color: colors.white, fontSize: 13, fontFamily: fonts.ui },

  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: 14, alignItems: 'center', marginTop: 12,
  },
  btnDone: { backgroundColor: colors.success },
  btnText: { color: colors.bg, fontFamily: fonts.ui, fontSize: 14 },

  empty: {
    color: colors.muted, textAlign: 'center',
    marginTop: 40, fontFamily: fonts.body, fontSize: 14,
  },
});
