import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { getMyStdTableReservations, cancelMyStdReservation } from '../../services/tableReservations';
import { TableReservation } from '../../types/tableReservation';
import { getErrorMessage } from '../../utils/errorUtils';

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUT_COLOR: Record<string, string> = {
  en_attente:           '#F5C842',
  acceptee:             '#7FCF9C',
  alternative_proposee: '#C9A227',
  refusee:              '#E55C5C',
  arrivee:              '#7FCF9C',
  terminee:             '#8E93AB',
  annulee:              '#8E93AB',
  expiree:              '#8E93AB',
};

const STATUT_LABEL: Record<string, string> = {
  en_attente:           'En attente',
  acceptee:             'Confirmée',
  alternative_proposee: 'Alternative',
  refusee:              'Refusée',
  arrivee:              'Arrivée',
  terminee:             'Terminée',
  annulee:              'Annulée',
  expiree:              'Expirée',
};

interface Props {
  onBack: () => void;
  onViewTicket: (reservation: TableReservation) => void;
}

export default function MesReservationsStdScreen({ onBack, onViewTicket }: Props) {
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMyStdTableReservations();
      setReservations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (resa: TableReservation) => {
    Alert.alert(
      'Annuler la réservation',
      'Confirmer l\'annulation ? L\'acompte vous sera remboursé.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMyStdReservation(resa.id);
              load();
            } catch (err) {
              Alert.alert('Erreur', getErrorMessage(err));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
            stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mes réservations</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {reservations.length === 0 ? (
            <View style={s.emptyBox}>
              <Svg width={48} height={48} viewBox="0 0 24 24">
                <Rect x="4" y="4" width="16" height="18" rx="2" stroke={colors.muted} strokeWidth={1.5} fill="none"/>
                <Path d="M8 10h8M8 13.5h8M8 17h5" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round"/>
              </Svg>
              <Text style={s.emptyTxt}>Aucune réservation de table</Text>
            </View>
          ) : (
            reservations.map(resa => {
              const statut = resa.statut ?? 'en_attente';
              const statusColor = STATUT_COLOR[statut] ?? colors.muted;
              const canCancel   = statut === 'en_attente' || statut === 'alternative_proposee';
              return (
                <TouchableOpacity
                  key={resa.id}
                  style={s.card}
                  onPress={() => onViewTicket(resa)}
                  activeOpacity={0.8}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardRestaurant}>
                        {resa.vip_profils?.nom_affiche ?? formatDateShort(resa.date_reservation)}
                      </Text>
                      {resa.vip_profils?.nom_affiche ? (
                        <Text style={s.cardMeta}>
                          {formatDateShort(resa.date_reservation)}
                          {resa.restaurant_spaces?.nom ? ` · ${resa.restaurant_spaces.nom}` : ''}
                        </Text>
                      ) : null}
                      <Text style={s.cardMeta}>
                        {resa.heure_debut?.slice(0, 5) ?? ''} · {resa.nb_personnes} pers.
                        {resa.restaurant_time_slots?.label ? ` · ${resa.restaurant_time_slots.label}` : ''}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { borderColor: statusColor }]}>
                      <Text style={[s.statusTxt, { color: statusColor }]}>
                        {STATUT_LABEL[statut] ?? statut}
                      </Text>
                    </View>
                  </View>

                  {resa.message_gerant ? (
                    <Text style={s.messageGerant} numberOfLines={2}>
                      💬 {resa.message_gerant}
                    </Text>
                  ) : null}

                  <View style={s.cardActions}>
                    <Text style={s.viewTicketBtn}>Voir le ticket →</Text>
                    {canCancel && (
                      <TouchableOpacity
                        onPress={() => handleCancel(resa)}
                        hitSlop={8}
                        activeOpacity={0.75}
                      >
                        <Text style={s.cancelBtn}>Annuler</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  content: { paddingHorizontal: 18, paddingTop: 20 },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 14 },

  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, padding: 14, marginBottom: 12, gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardRestaurant: { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 2 },
  cardMeta:       { color: colors.muted, fontFamily: fonts.ui,    fontSize: 12 },

  statusBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusTxt: { fontFamily: fonts.ui, fontSize: 11 },

  messageGerant: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 12,
    lineHeight: 18, fontStyle: 'italic',
  },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  viewTicketBtn: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },
  cancelBtn:     { color: '#E55C5C',     fontFamily: fonts.ui, fontSize: 12 },
});
