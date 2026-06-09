import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { ReservationTerrain, SPORT_EMOJI } from '../../types/terrain';
import { getMyTerrainReservations } from '../../services/terrains';
import logger from '../../utils/logger';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoQR = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15v2M15 19h2M19 19v2M21 21h-2" stroke={colors.accent} />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];

function formatDateCourt(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const STATUT_CFG: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: colors.muted },
  paye:       { label: 'Payé ✓',    color: colors.success },
  utilise:    { label: 'Utilisé',   color: colors.muted },
  expire:     { label: 'Expiré',    color: colors.danger },
  annule:     { label: 'Annulé',    color: colors.danger },
};

// ─── Carte réservation ────────────────────────────────────────────────────────

function ReservationCard({
  reservation,
  onShowQR,
}: {
  reservation: ReservationTerrain;
  onShowQR: () => void;
}) {
  const cfg = STATUT_CFG[reservation.statut] ?? { label: reservation.statut, color: colors.muted };
  const sport = reservation.terrains?.sport_type ?? 'autre';
  const nom   = reservation.terrains?.nom ?? 'Terrain';
  const actif = reservation.statut === 'paye';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{SPORT_EMOJI[sport as keyof typeof SPORT_EMOJI] ?? '🏟️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNom} numberOfLines={1}>{nom}</Text>
          <Text style={styles.cardDate}>{formatDateCourt(reservation.date_reservation)}</Text>
          <Text style={styles.cardCreneau}>
            {reservation.heure_debut} → {reservation.heure_fin}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.cardPrix}>{formatPrice(reservation.prix_total)}</Text>
          <View style={[styles.statutBadge, { backgroundColor: `${cfg.color}20` }]}>
            <Text style={[styles.statutTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      {actif && (
        <TouchableOpacity style={styles.qrBtn} onPress={onShowQR} activeOpacity={0.85}>
          <IcoQR />
          <Text style={styles.qrBtnTxt}>Voir le QR code</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Modal QR ─────────────────────────────────────────────────────────────────

function QRModal({
  reservation,
  onClose,
}: {
  reservation: ReservationTerrain;
  onClose: () => void;
}) {
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
  const nom = reservation.terrains?.nom ?? 'Terrain';

  return (
    <View style={styles.qrOverlay}>
      <View style={styles.qrSheet}>
        <Text style={styles.qrSheetTitle}>{nom}</Text>
        <Text style={styles.qrSheetSub}>
          {reservation.heure_debut} → {reservation.heure_fin}
        </Text>

        <View style={styles.qrWrapper}>
          <QRCode
            value={reservation.receipt_code}
            size={200}
            backgroundColor={colors.white}
            color={expired ? colors.danger : colors.bg}
          />
        </View>

        <Text style={styles.qrCode}>{reservation.receipt_code}</Text>

        <View style={[styles.timer, expired && styles.timerExpired]}>
          <Text style={[styles.timerTxt, expired && styles.timerTxtExpired]}>
            {expired ? 'QR code expiré' : `Valide encore ${minutes}:${seconds}`}
          </Text>
        </View>

        <Text style={styles.qrNote}>
          Présente ce code à l'entrée du terrain. Valable une seule fois.
        </Text>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeTxt}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function TerrainMyReservationsScreen({ onBack }: Props) {
  const [reservations, setReservations] = useState<ReservationTerrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrTarget, setQrTarget] = useState<ReservationTerrain | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMyTerrainReservations();
      setReservations(data);
    } catch (err) {
      logger.warn('[TerrainMyReservations] load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const actives  = reservations.filter(r => r.statut === 'paye');
  const passees  = reservations.filter(r => r.statut !== 'paye');

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes réservations terrain</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {reservations.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏟️</Text>
              <Text style={styles.emptyTitle}>Aucune réservation</Text>
              <Text style={styles.emptySub}>
                Tes réservations de terrain apparaîtront ici.
              </Text>
            </View>
          ) : (
            <>
              {actives.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>À venir</Text>
                  {actives.map(r => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onShowQR={() => setQrTarget(r)}
                    />
                  ))}
                </>
              )}

              {passees.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Historique</Text>
                  {passees.map(r => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onShowQR={() => setQrTarget(r)}
                    />
                  ))}
                </>
              )}
            </>
          )}

          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}

      {/* Modal QR */}
      {qrTarget && (
        <QRModal reservation={qrTarget} onClose={() => setQrTarget(null)} />
      )}
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 18 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17, flex: 1 },

  sectionLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginBottom: 10, overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardEmoji: { fontSize: 28, lineHeight: 34 },
  cardNom: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  cardDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  cardCreneau: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  cardPrix: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 14 },
  statutBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statutTxt: { fontFamily: fonts.ui, fontSize: 10 },

  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: `${colors.accent}08`,
  },
  qrBtnTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 64, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  emptySub: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center', lineHeight: 20,
  },

  // QR Modal
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.75)',
    justifyContent: 'flex-end',
  },
  qrSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, alignItems: 'center', gap: 14,
    paddingBottom: BOTTOM_PAD + 12,
  },
  qrSheetTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 17 },
  qrSheetSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  qrWrapper: {
    backgroundColor: colors.white,
    padding: 16, borderRadius: radius.lg,
  },
  qrCode: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 24, letterSpacing: 4 },
  timer: {
    backgroundColor: `${colors.success}18`,
    borderWidth: 1, borderColor: `${colors.success}35`,
    borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 7,
  },
  timerExpired: {
    backgroundColor: `${colors.danger}18`,
    borderColor: `${colors.danger}35`,
  },
  timerTxt: { color: colors.success, fontFamily: fonts.ui, fontSize: 13 },
  timerTxtExpired: { color: colors.danger },
  qrNote: {
    color: colors.muted, fontFamily: fonts.body,
    fontSize: 11, textAlign: 'center', lineHeight: 17,
  },
  closeBtn: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, height: 48, width: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
});
