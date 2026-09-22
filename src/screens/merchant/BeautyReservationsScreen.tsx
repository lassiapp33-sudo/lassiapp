import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Linking,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { BeautyReservation } from '../../types/beauty';
import { formatPrice } from '../../utils/format';
import { getErrorMessage } from '../../utils/errorUtils';
import * as beautyService from '../../services/beauty';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import logger from '../../utils/logger';
import QRScannerCamera from '../../components/terrain/QRScannerCamera';

// ─── Icônes ────────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.success} />
    <Path d="M8 12l3 3 5-6" stroke={colors.success} />
  </Svg>
);

const IcoX = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} stroke={colors.danger} />
    <Path d="M15 9l-6 6M9 9l6 6" stroke={colors.danger} />
  </Svg>
);

const IcoScan = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={colors.bg} />
    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={colors.bg} />
    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={colors.bg} />
    <Path d="M14 14h2v2h-2zM18 14v2M14 18h2M18 18v2M20 20h-2" stroke={colors.bg} />
  </Svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDateChips(): { iso: string; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d   = new Date(today);
    d.setDate(today.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const day = DAYS_SHORT[d.getDay()];
    return { iso, label: offset === 0 ? "Aujourd'hui" : `${day} ${d.getDate()}` };
  });
}

const STATUT_CFG: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: colors.muted },
  paye:       { label: 'Payé ✓',     color: colors.success },
  utilise:    { label: 'Validé',      color: colors.muted },
  expire:     { label: 'Expiré',      color: colors.danger },
  annule:     { label: 'Annulé',      color: colors.danger },
};

function isExpire(r: BeautyReservation): boolean {
  try {
    const fin  = String(r.heure_fin ?? '').slice(0, 5);
    const date = String(r.date_reservation ?? '');
    if (!fin || !date) return false;
    return new Date(`${date}T${fin}:00`) < new Date();
  } catch { return false; }
}

// ─── Carte réservation ─────────────────────────────────────────────────────────

type CardResult = { type: 'success' | 'error'; msg: string } | null;

function ReservationCard({ reservation, onValidate }: {
  reservation: BeautyReservation;
  onValidate: (code: string) => Promise<CardResult>;
}) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult]       = useState<CardResult>(null);
  const cfg    = STATUT_CFG[reservation.statut] ?? { label: reservation.statut, color: colors.muted };
  const expire = isExpire(reservation);
  const serviceNom = (reservation.beauty_services as { nom?: string } | null)?.nom ?? '—';

  const handleValidate = async () => {
    if (!reservation.receipt_code) return;
    setVerifying(true);
    const r = await onValidate(reservation.receipt_code);
    setResult(r);
    setVerifying(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNom}>{serviceNom}</Text>
          <Text style={styles.cardCreneau}>{reservation.heure_debut} → {reservation.heure_fin}</Text>
          {(reservation.client_name || reservation.client_phone) ? (
            <Text
              style={styles.cardClient}
              onPress={reservation.client_phone ? () => Linking.openURL(`tel:${reservation.client_phone}`) : undefined}
            >
              👤 {[reservation.client_name, reservation.client_phone].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {reservation.receipt_code && (
            <Text style={styles.cardCode}>Code : {reservation.receipt_code}</Text>
          )}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardPrix}>{formatPrice(reservation.montant_prestataire)}</Text>
          <View style={[styles.statutBadge, { backgroundColor: `${cfg.color}20` }]}>
            <Text style={[styles.statutTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      {result && (
        <View style={[styles.resultRow, result.type === 'success' ? styles.resultOk : styles.resultErr]}>
          {result.type === 'success' ? <IcoCheck /> : <IcoX />}
          <Text style={[styles.resultTxt, { color: result.type === 'success' ? colors.success : colors.danger }]}>
            {result.msg}
          </Text>
        </View>
      )}

      {reservation.statut === 'paye' && !result && !expire && (
        <TouchableOpacity
          style={[styles.validerBtn, verifying && { opacity: 0.6 }]}
          onPress={handleValidate}
          disabled={verifying}
          activeOpacity={0.85}
        >
          {verifying
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={styles.validerTxt}>Valider l'accès ✓</Text>
          }
        </TouchableOpacity>
      )}

      {reservation.statut === 'paye' && expire && !result && (
        <Text style={styles.expireTxt}>Créneau passé — accès non présenté</Text>
      )}
    </View>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  initialDate?: string; // ouverture directe sur la date d'une réservation (deep link notif)
}

// ─── Écran ─────────────────────────────────────────────────────────────────────

export default function BeautyReservationsScreen({ onBack, initialDate }: Props) {
  const prestataireId  = useAuthStore(s => s.user?.id ?? '');
  const DATE_CHIPS     = useMemo(() => buildDateChips(), []);
  const [dateSelected, setDateSelected] = useState(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayStr(),
  );
  const [reservations, setReservations] = useState<BeautyReservation[]>([]);
  const [loading, setLoading]           = useState(true);

  const [scanCode, setScanCode]         = useState('');
  const [scanning, setScanning]         = useState(false);
  const [scanResult, setScanResult]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [cameraOpen, setCameraOpen]     = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await beautyService.getBeautyReservationsByDate(prestataireId, dateSelected);
      setReservations(data);
    } catch (err) {
      logger.warn('[BeautyReservations] load:', err);
    } finally {
      setLoading(false);
    }
  }, [prestataireId, dateSelected]);

  useEffect(() => {
    loadReservations();

    const ch = supabase
      .channel(`merchant-beauty-${prestataireId}-${dateSelected}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'beauty_reservations',
        filter: `prestataire_id=eq.${prestataireId}`,
      }, () => loadReservations())
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [prestataireId, dateSelected, loadReservations]);

  const verifyCode = useCallback(async (code: string) => {
    try {
      const res = await beautyService.verifyBeautyReceipt(code.trim().toUpperCase());
      if (res.success) {
        await loadReservations();
        return { type: 'success' as const, msg: `Validé : ${res.heure_debut} → ${res.heure_fin}` };
      }
      return { type: 'error' as const, msg: res.error ?? 'Code invalide' };
    } catch (err) {
      return { type: 'error' as const, msg: getErrorMessage(err) };
    }
  }, [loadReservations]);

  const handleScanVerify = async () => {
    const cleaned = scanCode.trim().toUpperCase();
    if (cleaned.length < 4) return;
    setScanning(true);
    setScanResult(null);
    const result = await verifyCode(cleaned);
    setScanResult(result);
    setScanning(false);
    if (result.type === 'success') setScanCode('');
  };

  const payees = reservations.filter(r => r.statut === 'paye');
  const autres = reservations.filter(r => r.statut !== 'paye');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}><IcoBack /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Réservations Beauté</Text>
          <Text style={styles.headerSub}>Gestion des créneaux</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll} contentContainerStyle={styles.datesRow}>
        {DATE_CHIPS.map(({ iso, label }) => {
          const on = iso === dateSelected;
          return (
            <TouchableOpacity key={iso} style={[styles.dateChip, on && styles.dateChipOn]} onPress={() => setDateSelected(iso)} activeOpacity={0.8}>
              <Text style={[styles.dateTxt, on && styles.dateTxtOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : reservations.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aucune réservation</Text>
            <Text style={styles.emptySub}>Pas de rendez-vous pour cette date.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{payees.length}</Text>
                <Text style={styles.summaryLabel}>À valider</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{reservations.length}</Text>
                <Text style={styles.summaryLabel}>Total</Text>
              </View>
            </View>

            {payees.map(r => <ReservationCard key={r.id} reservation={r} onValidate={verifyCode} />)}
            {autres.map(r => <ReservationCard key={r.id} reservation={r} onValidate={verifyCode} />)}
          </>
        )}

        {/* Zone scan */}
        <View style={styles.scanSection}>
          <Text style={styles.scanTitle}>Vérifier un code</Text>

          <TouchableOpacity style={styles.cameraBtn} onPress={() => setCameraOpen(true)} activeOpacity={0.85}>
            <IcoScan />
            <Text style={styles.cameraBtnTxt}>Scanner avec la caméra</Text>
          </TouchableOpacity>

          <View style={styles.divRow}>
            <View style={styles.divLine} />
            <Text style={styles.divTxt}>ou code manuel</Text>
            <View style={styles.divLine} />
          </View>

          <Text style={styles.scanSub}>8 caractères affichés sous le QR du client</Text>

          <TextInput
            style={styles.scanInput}
            value={scanCode}
            onChangeText={v => { setScanCode(v.toUpperCase().slice(0, 8)); setScanResult(null); }}
            placeholder="Ex : A3F7B2C1"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            maxLength={8}
          />

          {scanResult && (
            <View style={[styles.scanResultBox, scanResult.type === 'success' ? styles.scanResultOk : styles.scanResultErr]}>
              {scanResult.type === 'success' ? <IcoCheck /> : <IcoX />}
              <Text style={[styles.scanResultTxt, { color: scanResult.type === 'success' ? colors.success : colors.danger }]}>
                {scanResult.msg}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.scanBtn, (scanCode.trim().length < 4 || scanning) && { opacity: 0.5 }]}
            onPress={handleScanVerify}
            disabled={scanCode.trim().length < 4 || scanning}
            activeOpacity={0.85}
          >
            {scanning ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.scanBtnTxt}>Vérifier ✓</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <QRScannerCamera
        visible={cameraOpen}
        onScan={async (scanned) => {
          setCameraOpen(false);
          setScanCode(scanned);
          setScanResult(null);
          setScanning(true);
          const result = await verifyCode(scanned);
          setScanResult(result);
          setScanning(false);
        }}
        onClose={() => setCameraOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { padding: 18 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  headerSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },

  datesScroll: { flexGrow: 0, flexShrink: 0 },
  datesRow:    { paddingHorizontal: 18, paddingVertical: 10, gap: 8, alignItems: 'center' },
  dateChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  dateChipOn:  { backgroundColor: colors.accent, borderColor: colors.accent },
  dateTxt:     { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  dateTxtOn:   { color: colors.bg },

  summaryRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem:   { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  summaryNum:    { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 22 },
  summaryLabel:  { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  card:         { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardNom:      { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  cardCreneau:  { color: colors.muted, fontFamily: fonts.ui, fontSize: 13, marginTop: 2 },
  cardCode:     { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  cardClient:   { color: colors.accent, fontFamily: fonts.ui, fontSize: 12.5, marginTop: 3 },
  cardRight:    { alignItems: 'flex-end' },
  cardPrix:     { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  statutBadge:  { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  statutTxt:    { fontFamily: fonts.ui, fontSize: 10 },

  resultRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderRadius: radius.sm, padding: 10 },
  resultOk:   { backgroundColor: `${colors.success}15` },
  resultErr:  { backgroundColor: `${colors.danger}15` },
  resultTxt:  { fontFamily: fonts.ui, fontSize: 13, flex: 1 },

  validerBtn:  { marginTop: 10, backgroundColor: colors.accent, borderRadius: radius.md, height: 38, alignItems: 'center', justifyContent: 'center' },
  validerTxt:  { color: colors.bg, fontFamily: fonts.title, fontSize: 13 },
  expireTxt:   { marginTop: 8, fontFamily: fonts.ui, fontSize: 12, color: colors.muted, fontStyle: 'italic' },

  emptyBox:   { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  emptySub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  scanSection: { marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 20 },
  scanTitle:   { color: colors.white, fontFamily: fonts.title, fontSize: 15, marginBottom: 12 },
  scanSub:     { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginBottom: 10, lineHeight: 18 },

  cameraBtn:    { width: '100%', height: 50, borderRadius: radius.lg, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
  cameraBtnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },

  divRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, marginVertical: 8 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt:  { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  scanInput:     { height: 56, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.accent, borderRadius: radius.lg, color: colors.white, fontFamily: fonts.titleXL, fontSize: 24, textAlign: 'center', letterSpacing: 5, marginBottom: 12 },
  scanResultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, padding: 10, marginBottom: 12 },
  scanResultOk:  { backgroundColor: `${colors.success}15` },
  scanResultErr: { backgroundColor: `${colors.danger}15` },
  scanResultTxt: { fontFamily: fonts.ui, fontSize: 13, flex: 1 },
  scanBtn:       { height: 48, backgroundColor: colors.accent, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  scanBtnTxt:    { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
});
