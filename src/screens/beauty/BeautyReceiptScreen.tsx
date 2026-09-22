import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { formatPrice } from '../../utils/format';

// ─── Icônes ────────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" strokeWidth={1.5}>
    <Circle cx={12} cy={12} r={10} stroke={colors.success} />
    <Path d="M8 12l3 3 5-6" stroke={colors.success} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Helpers date ──────────────────────────────────────────────────────────────

const DAYS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  receiptCode: string;
  serviceNom: string;
  prestataireName: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  prixTotal: number;
  onClose: () => void;
}

// ─── Écran ─────────────────────────────────────────────────────────────────────

export default function BeautyReceiptScreen({
  receiptCode, serviceNom, prestataireName,
  dateReservation, heureDebut, heureFin, prixTotal, onClose,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <Text style={styles.topTitle}>Rendez-vous payé</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successBanner}>
          <IcoCheck />
          <Text style={styles.successTitle}>Paiement accepté ✓</Text>
          <Text style={styles.successSub}>Présente ce QR code au prestataire</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrBox}>
          <QRCode
            value={receiptCode}
            size={180}
            backgroundColor={colors.surface}
            color={colors.white}
          />
          <Text style={styles.qrCode}>{receiptCode}</Text>
        </View>

        {/* Détails */}
        <View style={styles.detailCard}>
          <Text style={styles.detailService}>{serviceNom}</Text>
          <Text style={styles.detailPresta}>Chez {prestataireName}</Text>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Date</Text>
            <Text style={styles.detailVal}>{formatDateFr(dateReservation)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Créneau</Text>
            <Text style={styles.detailVal}>{heureDebut} → {heureFin}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Total payé</Text>
            <Text style={[styles.detailVal, { color: colors.accent }]}>{formatPrice(prixTotal)}</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeTxt}>Retour à la vitrine</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },

  topBar: {
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    alignItems: 'center',
  },
  topTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },

  successBanner: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  successTitle:  { color: colors.success, fontFamily: fonts.title, fontSize: 18 },
  successSub:    { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  qrBox: {
    alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    padding: 24, gap: 12, marginBottom: 20,
  },
  qrCode: {
    color: colors.white, fontFamily: fonts.titleXL,
    fontSize: 20, letterSpacing: 4,
  },

  detailCard:    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16 },
  detailService: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  detailPresta:  { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  divider:       { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailKey:     { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  detailVal:     { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: BOTTOM_PAD,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  closeBtn: { height: 54, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 15 },
});
