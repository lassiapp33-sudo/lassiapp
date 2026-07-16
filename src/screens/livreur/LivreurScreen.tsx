import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { formatPrice } from '../../utils/format';
import {
  getLivraisonsDisponibles,
  getMesLivraisons,
  accepterLivraison,
  terminerLivraison,
  Livraison,
} from '../../services/livraisons';
import useAuthStore from '../../store/authStore';

interface Props {
  onLogout: () => void;
}

export default function LivreurScreen({ onLogout }: Props) {
  const name = useAuthStore(s => s.user?.name ?? 'Livreur');
  const [pool, setPool] = useState<Livraison[]>([]);
  const [enCours, setEnCours] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [disponibles, miennes] = await Promise.all([
        getLivraisonsDisponibles(),
        getMesLivraisons(),
      ]);
      setPool(disponibles);
      setEnCours(miennes);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAccepter = (liv: Livraison) => {
    Alert.alert(
      'Accepter cette livraison ?',
      `Vers : ${liv.arrivee_label}\nPrix : ${formatPrice(liv.prix_livraison)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setActionId(liv.id);
            const result = await accepterLivraison(liv.id);
            setActionId(null);
            if (!result.success) {
              Alert.alert('Erreur', result.error);
            } else {
              load();
            }
          },
        },
      ],
    );
  };

  const handleTerminer = (liv: Livraison) => {
    Alert.alert(
      'Livraison terminée ?',
      'Confirme que tu as remis la commande au client.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setActionId(liv.id);
            const result = await terminerLivraison(liv.id);
            setActionId(null);
            if (!result.success) {
              Alert.alert('Erreur', result.error);
            } else {
              load();
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item, isMine }: { item: Livraison; isMine: boolean }) => {
    const busy = actionId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: (isMine ? colors.orange : colors.success) + '22' }]}>
            <Text style={styles.badgeTxt}>{isMine ? 'Ma livraison' : 'Disponible'}</Text>
          </View>
          <Text style={styles.prix}>{formatPrice(item.prix_livraison)}</Text>
        </View>

        <Text style={styles.label}>Départ</Text>
        <Text style={styles.value}>{item.depart_label}</Text>
        <Text style={styles.label}>Arrivée</Text>
        <Text style={styles.value}>{item.arrivee_label}</Text>

        {item.contact_nom ? (
          <>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>
              {item.contact_nom}{item.contact_tel ? ` · ${item.contact_tel}` : ''}
            </Text>
          </>
        ) : null}

        <Text style={styles.dist}>{Number(item.distance_km).toFixed(1)} km estimé</Text>

        {!isMine && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleAccepter(item)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={styles.btnTxt}>Accepter</Text>
            }
          </TouchableOpacity>
        )}

        {isMine && (
          <TouchableOpacity
            style={[styles.btn, styles.btnTerminer]}
            onPress={() => handleTerminer(item)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={styles.btnTxt}>Livraison terminée</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const allItems: Array<{ item: Livraison; isMine: boolean }> = [
    ...enCours.map(l => ({ item: l, isMine: true })),
    ...pool.map(l => ({ item: l, isMine: false })),
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <View>
          <Text style={styles.title}>Espace Livreur</Text>
          <Text style={styles.subtitle}>{name}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.75}>
          <Text style={styles.logoutTxt}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={i => i.item.id}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTxt}>Aucune livraison disponible pour l'instant.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },
  subtitle: { color: colors.muted, fontFamily: fonts.label, fontSize: 13, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutTxt: { color: colors.muted, fontFamily: fonts.label, fontSize: 13 },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { color: colors.white, fontFamily: fonts.label, fontSize: 11 },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 18 },

  label: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 4 },
  value: { color: colors.white, fontFamily: fonts.body, fontSize: 14 },
  dist: { color: colors.muted, fontFamily: fonts.label, fontSize: 12, marginTop: 6 },

  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnTerminer: { backgroundColor: colors.success },
  btnTxt: { color: colors.bg, fontFamily: fonts.ui, fontSize: 15 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
