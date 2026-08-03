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
import { IcoCheckCircle } from '../../components/common/LassiIcons';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { TableReservation, MOTIF_LABEL, MOTIF_EMOJI } from '../../types/tableReservation';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatHeure(time: string): string {
  return time.slice(0, 5);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reservation: TableReservation;
  vipNom: string;
  onBack: () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ReservationTicketScreen({ reservation, vipNom, onBack }: Props) {
  const qrCode = reservation.qr_code ?? '';

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mon ticket</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Badge acceptée */}
        <View style={s.accepteeBadge}>
          <IcoCheckCircle size={56} />
          <Text style={s.accepteeTitle}>Réservation confirmée</Text>
          <Text style={s.accepteeSub}>Présentez ce ticket à votre arrivée</Text>
        </View>

        {/* QR Code */}
        {qrCode ? (
          <View style={s.qrCard}>
            <View style={s.qrWrapper}>
              <QRCode
                value={qrCode}
                size={200}
                backgroundColor="#FFFFFF"
                color={r.couleur.encre}
              />
            </View>
            <Text style={s.qrCodeTxt}>{qrCode}</Text>
            <Text style={s.qrCodeLabel}>Code de validation — usage unique</Text>
          </View>
        ) : (
          <View style={s.enAttenteCard}>
            <Text style={s.enAttenteEmoji}>⏳</Text>
            <Text style={s.enAttenteTxt}>En attente de confirmation du restaurant</Text>
          </View>
        )}

        {/* Détails */}
        <View style={s.detailsCard}>
          <Text style={s.detailsRestaurant}>{vipNom}</Text>
          <View style={s.divider} />

          <DetailRow label="Date"     value={formatDateFr(reservation.date_reservation)} />
          <DetailRow label="Heure"    value={formatHeure(reservation.heure_debut)} />
          <DetailRow label="Convives" value={`${reservation.nb_personnes} personne${reservation.nb_personnes > 1 ? 's' : ''}`} />

          {reservation.motif && (
            <DetailRow
              label="Occasion"
              value={`${MOTIF_EMOJI[reservation.motif]} ${MOTIF_LABEL[reservation.motif]}`}
            />
          )}

          {reservation.restaurant_spaces?.nom && (
            <DetailRow label="Espace" value={reservation.restaurant_spaces.nom} />
          )}

          {reservation.restaurant_time_slots?.label && (
            <DetailRow
              label="Créneau"
              value={`${reservation.restaurant_time_slots.label} — ${formatHeure(reservation.restaurant_time_slots.heure_debut)} à ${formatHeure(reservation.restaurant_time_slots.heure_fin)}`}
            />
          )}

          <View style={s.divider} />
          <DetailRow label="Acompte payé" value="3 000 FCFA" />
          <Text style={s.deductNote}>
            3 000 FCFA seront déduits de votre note sur place.
          </Text>
        </View>

        {/* Message du gérant */}
        {reservation.message_gerant && (
          <View style={s.messageCard}>
            <Text style={s.messageTitre}>Message du restaurant</Text>
            <Text style={s.messageTxt}>« {reservation.message_gerant} »</Text>
          </View>
        )}

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Platform.OS === 'ios' ? 34 : 14 }]}>
        <TouchableOpacity style={s.doneBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.doneTxt}>Retour à mes réservations</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailKey}>{label}</Text>
      <Text style={s.detailVal}>{value}</Text>
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

  content: { paddingHorizontal: 18, paddingTop: 24, alignItems: 'center' },

  accepteeBadge: { alignItems: 'center', marginBottom: 24, gap: 6 },
  accepteeTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 18 },
  accepteeSub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 13, textAlign: 'center' },

  qrCard: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 14,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
  },
  qrCodeTxt: {
    color: r.couleur.or,
    fontFamily: r.police.titre,
    fontSize: 22,
    letterSpacing: 3,
  },
  qrCodeLabel: {
    color: r.couleur.gris,
    fontFamily: r.police.util,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  enAttenteCard: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 10,
  },
  enAttenteEmoji: { fontSize: 40 },
  enAttenteTxt:   { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13, textAlign: 'center' },

  detailsCard: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 16,
    width: '100%',
    marginBottom: 14,
  },
  detailsRestaurant: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14 },
  divider: { height: 1, backgroundColor: r.couleur.filetFin, marginVertical: 10 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailKey: { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12 },
  detailVal: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, textAlign: 'right', flex: 1, paddingLeft: 8 },
  deductNote: {
    color: r.couleur.gris,
    fontFamily: r.police.util,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },

  messageCard: {
    backgroundColor: `${r.couleur.or}0E`,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 14,
    width: '100%',
    marginBottom: 14,
  },
  messageTitre: { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },
  messageTxt:   { color: r.couleur.ivoire,  fontFamily: r.police.corpsIt, fontSize: 13, lineHeight: 20 },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: r.couleur.filet,
  },
  doneBtn: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.or,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTxt: { color: r.couleur.or, fontFamily: r.police.titre, fontSize: 14 },
});
