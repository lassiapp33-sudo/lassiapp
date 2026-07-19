import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Linking,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import {
  getLivraisonsDisponibles, getMesLivraisons,
  accepterLivraison, terminerLivraison, Livraison,
  getMesLivraisonsTerminees, getMesVersements,
  calcSoldeNonVerse, VersementLivreurRow,
} from '../../services/livraisons';

interface Props {
  onLogout: () => void;
}

type Onglet = 'dispo' | 'encours' | 'gains' | 'historique';

export default function LivreurScreen({ onLogout }: Props) {
  const [dispos,     setDispos]     = useState<Livraison[]>([]);
  const [miennes,    setMiennes]    = useState<Livraison[]>([]);
  const [terminees,  setTerminees]  = useState<Livraison[]>([]);
  const [versements, setVersements] = useState<VersementLivreurRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [onglet,     setOnglet]     = useState<Onglet>('dispo');

  const charger = useCallback(async () => {
    setRefreshing(true);
    const [d, m, t, v] = await Promise.all([
      getLivraisonsDisponibles(),
      getMesLivraisons(),
      getMesLivraisonsTerminees(),
      getMesVersements(),
    ]);
    setDispos(d);
    setMiennes(m);
    setTerminees(t);
    setVersements(v);
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

  const solde = useMemo(
    () => calcSoldeNonVerse(terminees, versements),
    [terminees, versements],
  );

  const liste = useMemo((): Livraison[] => {
    if (onglet === 'dispo')      return dispos;
    if (onglet === 'encours')    return miennes;
    if (onglet === 'historique') return terminees;
    return [];
  }, [onglet, dispos, miennes, terminees]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Espace Livreur</Text>
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.75}>
          <Text style={s.logoutTxt}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* ── Onglets ── */}
      <View style={s.tabs}>
        {([
          ['dispo',      `Dispo (${dispos.length})`],
          ['encours',    `En cours (${miennes.length})`],
          ['gains',      'Mes gains'],
          ['historique', 'Historique'],
        ] as [Onglet, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, onglet === key && s.tabActive]}
            onPress={() => setOnglet(key)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, onglet === key && s.tabTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Onglet Gains ── */}
      {onglet === 'gains' ? (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={charger} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            <View style={s.gainsWrap}>
              {/* Solde principal */}
              <View style={s.soldeCard}>
                <Text style={s.soldeLabel}>Solde en attente de versement</Text>
                <Text style={s.soldeMontant}>{solde.montantNet.toLocaleString()} F</Text>
                <Text style={s.soldeSub}>{solde.nbCourses} course{solde.nbCourses !== 1 ? 's' : ''} non encore payées</Text>
              </View>

              {/* Détail */}
              <View style={s.detailCard}>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Montant brut des courses</Text>
                  <Text style={s.detailVal}>{solde.montantBrut.toLocaleString()} F</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Commission LASSİ (15%)</Text>
                  <Text style={s.detailNeg}>− {Math.round(solde.montantBrut * 0.15).toLocaleString()} F</Text>
                </View>
                <View style={[s.detailRow, s.detailRowLast]}>
                  <Text style={s.detailLabelBold}>Net à recevoir</Text>
                  <Text style={s.detailAccent}>{solde.montantNet.toLocaleString()} F</Text>
                </View>
              </View>

              {/* Historique des versements */}
              {versements.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>Versements reçus</Text>
                  {versements.map(v => (
                    <View key={v.id} style={s.versCard}>
                      <View style={s.versRow}>
                        <Text style={s.versMontant}>{v.montant_net.toLocaleString()} F</Text>
                        <Text style={s.versCourses}>{v.nb_courses} course{v.nb_courses !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={s.versDate}>
                        {new Date(v.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {solde.nbCourses === 0 && versements.length === 0 && (
                <Text style={s.empty}>Aucune course terminée pour le moment.</Text>
              )}
            </View>
          }
          renderItem={() => null}
        />
      ) : (
        /* ── Listes courses (dispo / en cours / historique) ── */
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
                : onglet === 'encours'
                ? 'Aucune livraison en cours.'
                : 'Aucune livraison terminée.'}
            </Text>
          }
          renderItem={({ item }) => (
            <LivraisonCard
              item={item}
              onglet={onglet}
              onAccepter={handleAccepter}
              onTerminer={handleTerminer}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── LivraisonCard ────────────────────────────────────────────────────────────

interface CardProps {
  item:       Livraison;
  onglet:     Onglet;
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

      {onglet === 'historique' && item.terminee_at ? (
        <Text style={s.termineeDate}>
          Terminée le {new Date(item.terminee_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </Text>
      ) : null}

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

      {onglet === 'dispo' && (
        <TouchableOpacity style={s.btn} onPress={() => onAccepter(item.id)} activeOpacity={0.85}>
          <Text style={s.btnText}>Accepter la livraison</Text>
        </TouchableOpacity>
      )}
      {onglet === 'encours' && (
        <TouchableOpacity style={[s.btn, s.btnDone]} onPress={() => onTerminer(item.id)} activeOpacity={0.85}>
          <Text style={s.btnText}>Livraison terminée</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 12 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: radius.md,
    backgroundColor: colors.surface, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 4,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
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

  termineeDate: { color: colors.muted, fontFamily: fonts.label, fontSize: 12, marginTop: 4 },

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

  // Gains
  gainsWrap: { padding: 16, paddingBottom: 40 },

  soldeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent + '55',
    marginBottom: 16,
  },
  soldeLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 12, marginBottom: 10 },
  soldeMontant: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 38, marginBottom: 8 },
  soldeSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailRowLast: { borderBottomWidth: 0, paddingTop: 12 },
  detailLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  detailLabelBold: { color: colors.white, fontFamily: fonts.ui, fontSize: 14 },
  detailVal: { color: colors.white, fontFamily: fonts.body, fontSize: 13 },
  detailNeg: { color: '#f87171', fontFamily: fonts.body, fontSize: 13 },
  detailAccent: { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },

  sectionTitle: {
    color: colors.muted, fontFamily: fonts.label, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },

  versCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  versRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  versMontant: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  versCourses: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },
  versDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
});
