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
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getLivraisonsDisponibles();
      setLivraisons(data);
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
      `Vers : ${liv.arriveeLabel}\nPrix : ${formatPrice(liv.prixLivraison)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            setActionId(liv.id);
            try {
              await accepterLivraison(liv.id);
              await load();
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible d\'accepter.');
            } finally {
              setActionId(null);
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
            try {
              await terminerLivraison(liv.id);
              await load();
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible de terminer.');
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Livraison }) => {
    const isMine = item.statut === 'acceptee';
    const busy = actionId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.badge(isMine ? colors.orange : colors.success)}>
            <Text style={styles.badgeTxt}>{isMine ? 'Ma livraison' : 'Disponible'}</Text>
          </View>
          <Text style={styles.prix}>{formatPrice(item.prixLivraison)}</Text>
        </View>

        <Text style={styles.label}>Départ</Text>
        <Text style={styles.value}>{item.departLabel}</Text>
        <Text style={styles.label}>Arrivée</Text>
        <Text style={styles.value}>{item.arriveeLabel}</Text>

        {item.contactNom ? (
          <>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>
              {item.contactNom}{item.contactTel ? ` · ${item.contactTel}` : ''}
            </Text>
          </>
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.dist}>{item.distanceKm.toFixed(1)} km</Text>
        </View>

        {!isMine && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => handleAccepter(item)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.btnTxt}>Accepter</Text>
            )}
          </TouchableOpacity>
        )}

        {isMine && (
          <TouchableOpacity
            style={[styles.btn, styles.btnTerminer]}
            onPress={() => handleTerminer(item)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.btnTxt}>Livraison terminée</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
          data={livraisons}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
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
  badge: (bg: string) => ({
    backgroundColor: bg + '22',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  }),
  badgeTxt: { color: colors.white, fontFamily: fonts.label, fontSize: 11 },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 18 },

  label: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 4 },
  value: { color: colors.white, fontFamily: fonts.body, fontSize: 14 },

  meta: { flexDirection: 'row', marginTop: 8 },
  dist: { color: colors.muted, fontFamily: fonts.label, fontSize: 12 },

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
} as any);
