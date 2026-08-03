import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { IcoPlate } from '../../components/common/LassiIcons';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { getMyTableReservations } from '../../services/tableReservations';
import { TableReservation, TableReservationStatut, MOTIF_LABEL, MOTIF_EMOJI } from '../../types/tableReservation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUT_LABEL: Record<TableReservationStatut, string> = {
  en_attente:           'En attente',
  acceptee:             'Acceptée',
  alternative_proposee: 'Alternative proposée',
  refusee:              'Refusée',
  arrivee:              'Arrivée validée',
  terminee:             'Terminée',
  annulee:              'Annulée',
};

const STATUT_COLOR: Record<TableReservationStatut, string> = {
  en_attente:           '#F5C842',
  acceptee:             '#7FCF9C',
  alternative_proposee: '#C9A227',
  refusee:              '#E55C5C',
  arrivee:              '#7FCF9C',
  terminee:             '#8E93AB',
  annulee:              '#8E93AB',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onViewTicket: (reservation: TableReservation) => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function MesReservationsTableScreen({ onBack, onViewTicket }: Props) {
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyTableReservations();
      setReservations(data);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mes réservations</Text>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={r.couleur.or} size="large" />
        </View>
      ) : reservations.length === 0 ? (
        <View style={s.emptyBox}>
          <IcoPlate size={64} />
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>
            Vos réservations de table dans les restaurants 5 Étoiles LASSI apparaîtront ici.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={r.couleur.or}
            />
          }
        >
          {reservations.map(resa => {
            const statut = resa.statut as TableReservationStatut;
            const statutColor = STATUT_COLOR[statut] ?? r.couleur.gris;
            return (
              <TouchableOpacity
                key={resa.id}
                style={s.card}
                onPress={() => onViewTicket(resa)}
                activeOpacity={0.85}
              >
                {/* En-tête carte */}
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.cardDate}>{formatDateShort(resa.date_reservation)}</Text>
                    <Text style={s.cardHeure}>{resa.heure_debut.slice(0, 5)}</Text>
                  </View>
                  <View style={[s.statutBadge, { borderColor: statutColor }]}>
                    <Text style={[s.statutTxt, { color: statutColor }]}>{STATUT_LABEL[statut]}</Text>
                  </View>
                </View>

                {/* Détails */}
                <View style={s.cardRow}>
                  <Text style={s.cardKey}>Convives</Text>
                  <Text style={s.cardVal}>{resa.nb_personnes} personne{resa.nb_personnes > 1 ? 's' : ''}</Text>
                </View>

                {resa.motif && (
                  <View style={s.cardRow}>
                    <Text style={s.cardKey}>Occasion</Text>
                    <Text style={s.cardVal}>{MOTIF_EMOJI[resa.motif]} {MOTIF_LABEL[resa.motif]}</Text>
                  </View>
                )}

                {resa.restaurant_spaces?.nom && (
                  <View style={s.cardRow}>
                    <Text style={s.cardKey}>Espace</Text>
                    <Text style={s.cardVal}>{resa.restaurant_spaces.nom}</Text>
                  </View>
                )}

                {resa.restaurant_time_slots?.label && (
                  <View style={s.cardRow}>
                    <Text style={s.cardKey}>Créneau</Text>
                    <Text style={s.cardVal}>{resa.restaurant_time_slots.label}</Text>
                  </View>
                )}

                {/* Alternative proposée */}
                {statut === 'alternative_proposee' && resa.alt_date && (
                  <View style={s.altBox}>
                    <Text style={s.altTitle}>Alternative proposée</Text>
                    <Text style={s.altTxt}>
                      {formatDateShort(resa.alt_date)}
                      {resa.alt_heure_debut ? ` à ${resa.alt_heure_debut.slice(0, 5)}` : ''}
                    </Text>
                    {resa.alt_message && <Text style={s.altMsg}>{resa.alt_message}</Text>}
                  </View>
                )}

                {/* CTA voir ticket */}
                {(statut === 'acceptee' || statut === 'arrivee') && resa.qr_code && (
                  <View style={s.ticketCta}>
                    <Text style={s.ticketCtaTxt}>Voir le ticket →</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: r.couleur.encre },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filet,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 16 },
  emptySub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 13, textAlign: 'center', lineHeight: 18 },

  content: { padding: 18 },

  card: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardDate:  { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14 },
  cardHeure: { color: r.couleur.or,     fontFamily: r.police.util,  fontSize: 12, marginTop: 2 },
  statutBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statutTxt: { fontFamily: r.police.util, fontSize: 11 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardKey: { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12 },
  cardVal: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12 },

  altBox: {
    backgroundColor: `${r.couleur.or}0E`,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    gap: 4,
  },
  altTitle: { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  altTxt:   { color: r.couleur.ivoire,  fontFamily: r.police.util, fontSize: 12 },
  altMsg:   { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 11, fontStyle: 'italic' },

  ticketCta: {
    borderTopWidth: 1,
    borderTopColor: r.couleur.filetFin,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  ticketCtaTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },
});
