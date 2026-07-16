import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { formatPrice } from '../../utils/format';
import { getLivraisonsDemandeur, Livraison } from '../../services/livraisons';

interface Props {
  onBack: () => void;
}

const IcoBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.white} />
  </Svg>
);

const STATUT_CONFIG: Record<Livraison['statut'], { label: string; color: string }> = {
  en_attente: { label: 'En attente',  color: colors.accent },
  acceptee:   { label: 'En cours',    color: '#5B9EF7' },
  terminee:   { label: 'Livrée',      color: colors.success },
  annulee:    { label: 'Annulée',     color: colors.danger },
};

export default function MesLivraisonsScreen({ onBack }: Props) {
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = useCallback(async () => {
    const data = await getLivraisonsDemandeur();
    setLivraisons(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const onRefresh = () => { setRefreshing(true); charger(); };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.title}>Mes livraisons</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={livraisons}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.empty}>Aucune livraison pour l'instant.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUT_CONFIG[item.statut];
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.badge, { backgroundColor: cfg.color + '22' }]}>
                    <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={s.prix}>{formatPrice(item.prix_livraison)}</Text>
                </View>

                <Text style={s.fieldLabel}>Départ</Text>
                <Text style={s.fieldValue}>{item.depart_label}</Text>
                <Text style={s.fieldLabel}>Arrivée</Text>
                <Text style={s.fieldValue}>{item.arrivee_label}</Text>

                {item.contact_nom ? (
                  <>
                    <Text style={s.fieldLabel}>Destinataire</Text>
                    <Text style={s.fieldValue}>
                      {item.contact_nom}{item.contact_tel ? ` · ${item.contact_tel}` : ''}
                    </Text>
                  </>
                ) : null}

                <Text style={s.meta}>
                  {Number(item.distance_km).toFixed(1)} km
                  {item.created_at
                    ? ` · ${new Date(item.created_at).toLocaleDateString('fr-SN', {
                        day: 'numeric', month: 'short',
                      })}`
                    : ''}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { fontFamily: fonts.label, fontSize: 11 },
  prix: { color: colors.accent, fontFamily: fonts.title, fontSize: 17 },

  fieldLabel: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 6 },
  fieldValue: { color: colors.white, fontFamily: fonts.body, fontSize: 14 },
  meta: { color: colors.muted, fontFamily: fonts.label, fontSize: 11, marginTop: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
