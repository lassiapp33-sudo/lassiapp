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
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  receiptCode: string;
  terrainNom: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  prestataireName: string;
  prixTotal: number;
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainQRScreen({
  receiptCode,
  terrainNom,
  dateReservation,
  heureDebut,
  heureFin,
  prestataireName,
  prixTotal,
  onBack,
}: Props) {
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation confirmée</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge succès */}
        <View style={styles.successBadge}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Paiement reçu</Text>
          <Text style={styles.successSub}>
            Présente ce QR code à l'entrée du terrain
          </Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={receiptCode}
              size={200}
              backgroundColor={colors.white}
              color={colors.bg}
            />
          </View>
          <Text style={styles.receiptCode}>{receiptCode}</Text>
          <Text style={styles.receiptCodeLabel}>Code de validation</Text>
        </View>

        {/* Détails réservation */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTerrain}>{terrainNom}</Text>
          <Text style={styles.detailsPresta}>Chez {prestataireName}</Text>
          <View style={styles.divider} />
          <DetailRow label="Date" value={formatDateFr(dateReservation)} />
          <DetailRow label="Créneau" value={`${heureDebut} → ${heureFin}`} />
          <DetailRow label="Total payé" value={formatPrice(prixTotal)} accent />
        </View>

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Ce QR code sera scanné par le prestataire à ton arrivée. Il ne peut être utilisé qu'une seule fois.
          </Text>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.doneTxt}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailKey}>{label}</Text>
      <Text style={[styles.detailVal, accent && styles.detailValAccent]}>{value}</Text>
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
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
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: 'center',
  },

  successBadge: { alignItems: 'center', marginBottom: 24, gap: 8 },
  successEmoji: { fontSize: 48 },
  successTitle: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20 },
  successSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },

  qrCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 14,
  },
  qrWrapper: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: radius.lg,
  },
  receiptCode: {
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 28,
    letterSpacing: 4,
  },
  receiptCodeLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  detailsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    width: '100%',
    marginBottom: 14,
  },
  detailsTerrain: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  detailsPresta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailKey: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  detailVal: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  detailValAccent: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 16 },

  noteBox: {
    backgroundColor: `${colors.accent}10`,
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
    borderRadius: radius.md,
    padding: 14,
    width: '100%',
  },
  noteText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: BOTTOM_PAD,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  doneBtn: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
});
