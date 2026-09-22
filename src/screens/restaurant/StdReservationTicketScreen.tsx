import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { TableReservation, MOTIF_LABEL, MOTIF_EMOJI, OPTION_LABEL, OPTION_EMOJI } from '../../types/tableReservation';

const DAYS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUT_LABEL: Record<string, string> = {
  en_attente:           'En attente de confirmation',
  acceptee:             'Confirmée',
  alternative_proposee: 'Alternative proposée',
  refusee:              'Refusée',
  arrivee:              'Arrivée validée',
  terminee:             'Terminée',
  annulee:              'Annulée',
  expiree:              'Expirée',
};

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

interface Props {
  reservation: TableReservation;
  restaurantNom: string;
  onBack: () => void;
}

export default function StdReservationTicketScreen({ reservation, restaurantNom, onBack }: Props) {
  const statut     = reservation.statut ?? 'en_attente';
  const hasQR      = !!reservation.qr_code && statut === 'acceptee';
  const statusColor = STATUT_COLOR[statut] ?? colors.muted;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
            stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mon ticket</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Statut */}
        <View style={[s.statusBadge, { borderColor: statusColor }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusTxt, { color: statusColor }]}>
            {STATUT_LABEL[statut] ?? statut}
          </Text>
        </View>

        {/* QR Code (uniquement si acceptée) */}
        {hasQR && (
          <View style={s.qrContainer}>
            <QRCode
              value={reservation.qr_code!}
              size={200}
              backgroundColor="#fff"
              color="#14152A"
            />
            <Text style={s.qrInstruction}>Présentez ce QR code à l'entrée</Text>
          </View>
        )}

        {/* Infos de la réservation */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Réservation</Text>
          <InfoRow label="Restaurant" value={restaurantNom} />
          <InfoRow label="Date"       value={formatDateFr(reservation.date_reservation)} />
          <InfoRow label="Heure"      value={reservation.heure_debut?.slice(0, 5) ?? ''} />
          {reservation.restaurant_time_slots?.label && (
            <InfoRow label="Créneau" value={reservation.restaurant_time_slots.label} />
          )}
          {reservation.restaurant_spaces?.nom && (
            <InfoRow label="Espace" value={reservation.restaurant_spaces.nom} />
          )}
          <InfoRow label="Convives" value={`${reservation.nb_personnes} personne${reservation.nb_personnes > 1 ? 's' : ''}`} />
          {reservation.motif && (
            <InfoRow label="Occasion" value={`${MOTIF_EMOJI[reservation.motif]} ${MOTIF_LABEL[reservation.motif]}`} />
          )}
        </View>

        {/* Options spéciales */}
        {reservation.options_speciales?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Demandes spéciales</Text>
            {reservation.options_speciales.map(opt => (
              <Text key={opt} style={s.optionTxt}>
                {OPTION_EMOJI[opt as keyof typeof OPTION_EMOJI] ?? '•'} {OPTION_LABEL[opt as keyof typeof OPTION_LABEL] ?? opt}
              </Text>
            ))}
          </View>
        )}

        {/* Message du restaurant */}
        {reservation.message_gerant ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Message du restaurant</Text>
            <Text style={s.messageTxt}>{reservation.message_gerant}</Text>
          </View>
        ) : null}

        {/* Alternative proposée */}
        {statut === 'alternative_proposee' && (
          <View style={[s.card, s.altCard]}>
            <Text style={s.cardTitle}>Alternative proposée</Text>
            {reservation.alt_date       && <InfoRow label="Nouvelle date"  value={formatDateFr(reservation.alt_date)} />}
            {reservation.alt_heure_debut && <InfoRow label="Nouvelle heure" value={reservation.alt_heure_debut.slice(0, 5)} />}
            {reservation.alt_message    && <Text style={s.messageTxt}>{reservation.alt_message}</Text>}
          </View>
        )}

        {/* Paiement */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Paiement</Text>
          <InfoRow label="Montant payé" value={`${(reservation.montant_total ?? reservation.acompte_montant ?? 2100).toLocaleString('fr-FR')} FCFA`} />
          <InfoRow label="Acompte (déduit de l'addition)" value={`${(reservation.acompte_montant ?? 2000).toLocaleString('fr-FR')} FCFA`} />
          {reservation.frais_service ? (
            <InfoRow label="Frais de service" value={`${reservation.frais_service.toLocaleString('fr-FR')} FCFA`} />
          ) : null}
          <Text style={s.acompteNote}>
            L'acompte sera entièrement déduit de votre addition sur place.
          </Text>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoKey}>{label}</Text>
      <Text style={s.infoVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  header:  {
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

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontFamily: fonts.ui, fontSize: 13 },

  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  qrInstruction: {
    color: '#14152A', fontFamily: fonts.ui, fontSize: 13,
    marginTop: 12, textAlign: 'center',
  },

  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 14, backgroundColor: colors.surface,
    gap: 8, marginBottom: 14,
  },
  altCard: { borderColor: '#C9A227' },
  cardTitle: {
    color: colors.accent, fontFamily: fonts.ui, fontSize: 10,
    letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey: { color: colors.muted,  fontFamily: fonts.ui, fontSize: 13 },
  infoVal: { color: colors.white,  fontFamily: fonts.ui, fontSize: 13, textAlign: 'right', maxWidth: '60%' },

  optionTxt:   { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  messageTxt:  { color: colors.white, fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  acompteNote: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
