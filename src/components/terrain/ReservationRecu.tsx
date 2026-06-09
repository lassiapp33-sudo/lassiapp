import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ReservationTerrain, Terrain, SPORT_EMOJI } from '../../types/terrain';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, accent && styles.rowAccent]}>{value}</Text>
    </View>
  );
}

interface Props {
  reservation: ReservationTerrain;
  terrain: Terrain;
  onRetour: () => void;
}

export default function ReservationRecu({ reservation, terrain, onRetour }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = new Date(reservation.receipt_valid_until).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [reservation.receipt_valid_until]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  const expired = remaining === 0;
  const qrColor = expired ? colors.danger : colors.bg;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge succès */}
        <View style={styles.successBadge}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Reservation confirmee !</Text>
          <Text style={styles.successSub}>
            Presente ce QR code a l'entree du terrain
          </Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.terrainNom}>
            {SPORT_EMOJI[terrain.sport_type]} {terrain.nom}
          </Text>

          <View style={styles.qrWrapper}>
            <QRCode
              value={reservation.receipt_code}
              size={190}
              backgroundColor={colors.white}
              color={qrColor}
            />
          </View>

          <Text style={styles.code}>{reservation.receipt_code}</Text>

          {/* Countdown */}
          <View style={[styles.timer, expired && styles.timerExpired]}>
            <Text style={[styles.timerText, expired && styles.timerTextExpired]}>
              {expired ? 'QR code expire' : `Valide encore  ${minutes}:${seconds}`}
            </Text>
          </View>

          {!expired && (
            <Text style={styles.timerHint}>
              Le QR code change de couleur puis expire a la fin du creneau
            </Text>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.divider} />
          <Row label="Date" value={formatDateFr(reservation.date_reservation)} />
          <Row
            label="Creneau"
            value={`${reservation.heure_debut} → ${reservation.heure_fin}`}
          />
          <Row label="Total paye" value={formatPrice(reservation.prix_total)} accent />
        </View>

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Ce QR code sera scanne par le prestataire a ton arrivee.
            Il ne peut etre utilise qu'une seule fois.
          </Text>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.retourBtn} onPress={onRetour} activeOpacity={0.85}>
          <Text style={styles.retourTxt}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },

  successBadge: { alignItems: 'center', marginBottom: 24, gap: 6 },
  successEmoji: { fontSize: 48 },
  successTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },
  successSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  qrCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 24, alignItems: 'center',
    width: '100%', marginBottom: 16, gap: 14,
  },
  terrainNom: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  qrWrapper: { backgroundColor: colors.white, padding: 16, borderRadius: radius.lg },
  code: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 26, letterSpacing: 4 },

  timer: {
    backgroundColor: `${colors.success}18`,
    borderWidth: 1, borderColor: `${colors.success}35`,
    borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 8,
  },
  timerExpired: {
    backgroundColor: `${colors.danger}18`,
    borderColor: `${colors.danger}35`,
  },
  timerText: { color: colors.success, fontFamily: fonts.ui, fontSize: 14 },
  timerTextExpired: { color: colors.danger },
  timerHint: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 11, textAlign: 'center',
  },

  detailsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, width: '100%', marginBottom: 14,
  },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  rowValue: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  rowAccent: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },

  noteBox: {
    backgroundColor: `${colors.accent}10`, borderWidth: 1,
    borderColor: `${colors.accent}30`, borderRadius: radius.md,
    padding: 14, width: '100%',
  },
  noteText: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 12, lineHeight: 18, textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: BOTTOM_PAD,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  retourBtn: {
    height: 54, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  retourTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
});
