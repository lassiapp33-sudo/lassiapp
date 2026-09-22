import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { createStdTableReservation } from '../../services/tableReservations';
import { WeekHours, DayKey, DEFAULT_WEEK_HOURS } from '../../services/hours';
import { getErrorMessage } from '../../utils/errorUtils';
import { WAVE_ENABLED } from '../../config/features';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateLong(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
function pad(n: number): string { return String(n).padStart(2, '0'); }
function toMin(hhmm: string): number { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

// ─── Créneaux générés depuis les horaires du prestataire ────────────────────────

interface Slot { id: string; label: string; heure_debut: string; heure_fin: string }

function genSlots(hours: WeekHours, date: Date, isToday: boolean): Slot[] {
  const day = hours[JS_DAY_TO_KEY[date.getDay()]];
  if (!day || day.closed) return [];
  const openM  = toMin(day.open);
  let   closeM = toMin(day.close);
  if (closeM === 0) closeM = 1440;      // "00:00" = minuit fin de journée
  if (closeM <= openM) closeM += 1440;  // horaire qui passe minuit
  const nowM = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : -1;
  const out: Slot[] = [];
  // Un créneau par heure ; le dernier départ laisse 1h avant la fermeture
  for (let m = openM; m + 60 <= closeM; m += 60) {
    if (m <= nowM) continue; // créneau déjà passé aujourd'hui
    const s = `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`;
    const e = `${pad(Math.floor(((m + 60) % 1440) / 60))}:${pad((m + 60) % 60)}`;
    out.push({ id: s, label: s, heure_debut: `${s}:00`, heure_fin: `${e}:00` });
  }
  return out;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WAVE_LOGO = require('../../../assets/wave.jpg');
const OM_LOGO   = require('../../../assets/om.png');
const TOTAL     = 2100;   // total payé par le client
const ACOMPTE   = 2000;   // déduit de l'addition sur place
const FRAIS     = 100;    // frais de service LASSI

type PayMethod = 'wave' | 'orange_money';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  prestataireId: string;
  restaurantNom: string;
  /** Moyens de paiement autorisés par le prestataire ('wave' | 'om'). */
  allowedMethods: ('wave' | 'om')[];
  /** Horaires du prestataire — définissent directement les créneaux. */
  openingHours: WeekHours | null;
  onBack: () => void;
  onSuccess: () => void;
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function StdReservationFlowScreen({ prestataireId, restaurantNom, allowedMethods, openingHours, onBack, onSuccess }: Props) {
  // 7 prochains jours sélectionnables
  const dates = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i); return d;
    });
  }, []);
  const [dateIdx, setDateIdx] = useState(0);
  const selectedDate = dates[dateIdx];

  const hours = useMemo<WeekHours>(
    () => ({ ...DEFAULT_WEEK_HOURS, ...(openingHours ?? {}) }) as WeekHours,
    [openingHours],
  );
  const slots = useMemo(
    () => genSlots(hours, selectedDate, dateIdx === 0),
    [hours, selectedDate, dateIdx],
  );

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [nbPersonnes, setNbPersonnes]   = useState(2);

  // Moyens de paiement effectifs = choix prestataire ∩ activation globale Wave
  const effectiveMethods = useMemo<('wave' | 'om')[]>(() => {
    const base = (allowedMethods && allowedMethods.length ? allowedMethods : (['wave', 'om'] as ('wave' | 'om')[]));
    const filtered = base.filter(m => m !== 'wave' || WAVE_ENABLED);
    return filtered.length ? filtered : base;
  }, [allowedMethods]);

  const [payMethod, setPayMethod] = useState<PayMethod>(
    effectiveMethods[0] === 'wave' ? 'wave' : 'orange_money',
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(1);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      const result = await createStdTableReservation({
        prestataireId,
        dateReservation: toDateStr(selectedDate),
        heureDebut:      selectedSlot.heure_debut.slice(0, 5),
        nbPersonnes,
        moyenPaiement:   payMethod,
      });

      if (result.mode === 'simulation') { onSuccess(); return; }
      if (result.redirectUrl) {
        await Linking.openURL(result.redirectUrl);
        Alert.alert(
          'Paiement en cours',
          'Votre réservation sera confirmée dès la validation du paiement. Elle apparaîtra alors dans « Mes réservations ».',
        );
        onSuccess();
        return;
      }
      onSuccess();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Réserver une table</Text>
          <Text style={s.headerSub}>{restaurantNom}</Text>
        </View>
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeTxt}>{step}/3</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── ÉTAPE 1 : Date + Créneau ───────────────────────────────────── */}
        {step >= 1 && (
          <>
            <Text style={s.sectionTitle}>Choisissez une date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
              {dates.map((d, i) => {
                const sel = i === dateIdx;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dateChip, sel && s.dateChipOn]}
                    onPress={() => { setDateIdx(i); setSelectedSlot(null); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dateDay, sel && s.dateOn]}>{DAYS_FR[d.getDay()]}</Text>
                    <Text style={[s.dateNum, sel && s.dateOn]}>{d.getDate()}</Text>
                    <Text style={[s.dateMon, sel && s.dateOn]}>{MONTHS_FR[d.getMonth()]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sectionTitle}>Choisissez un créneau</Text>
            {slots.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>Fermé ce jour — aucun créneau disponible.</Text>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map(sl => {
                  const sel = selectedSlot?.id === sl.id;
                  return (
                    <TouchableOpacity
                      key={sl.id}
                      style={[s.slotChip, sel && s.slotChipOn]}
                      onPress={() => setSelectedSlot(sl)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.slotLabel, sel && s.slotLabelOn]}>{sl.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 1 && selectedSlot != null && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Continuer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 2 : Nombre de personnes ─────────────────────────────── */}
        {step >= 2 && (
          <>
            <Text style={s.sectionTitle}>Combien serez-vous ?</Text>
            <Text style={s.stepHint}>Indiquez le nombre de personnes pour votre table.</Text>
            <View style={s.counterRow}>
              <TouchableOpacity style={s.counterBtn} onPress={() => setNbPersonnes(n => Math.max(1, n - 1))} activeOpacity={0.8}>
                <Text style={s.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={s.counterVal}>{nbPersonnes}</Text>
              <TouchableOpacity style={s.counterBtn} onPress={() => setNbPersonnes(n => Math.min(100, n + 1))} activeOpacity={0.8}>
                <Text style={s.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>

            {step === 2 && nbPersonnes >= 1 && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Continuer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 3 : Paiement ──────────────────────────────────────────── */}
        {step >= 3 && (
          <>
            <Text style={s.sectionTitle}>Récapitulatif</Text>
            <View style={s.summaryCard}>
              <SummaryRow label="Restaurant" value={restaurantNom} />
              <SummaryRow label="Date"       value={formatDateLong(selectedDate)} />
              {selectedSlot && <SummaryRow label="Heure" value={selectedSlot.label} />}
              <SummaryRow label="Convives"   value={`${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}`} />
              <View style={s.summaryDivider} />
              <SummaryRow label="Acompte (déduit de l'addition)" value={`${ACOMPTE.toLocaleString('fr-FR')} FCFA`} />
              <SummaryRow label="Frais de service LASSI"        value={`${FRAIS.toLocaleString('fr-FR')} FCFA`} />
              <View style={s.summaryDivider} />
              <SummaryRow label="Total à payer" value={`${TOTAL.toLocaleString('fr-FR')} FCFA`} accent />
            </View>

            <View style={s.noticeBox}>
              <Text style={s.noticeTxt}>
                Vous payez <Text style={s.noticeStrong}>{TOTAL.toLocaleString('fr-FR')} FCFA</Text> pour confirmer
                votre réservation : <Text style={s.noticeStrong}>{ACOMPTE.toLocaleString('fr-FR')} FCFA</Text> d'acompte
                entièrement déduits de votre addition sur place, et <Text style={s.noticeStrong}>{FRAIS.toLocaleString('fr-FR')} FCFA</Text> de
                frais de service. Votre ticket est valable <Text style={s.noticeStrong}>1h</Text> après l'horaire réservé :
                passé ce délai sans présentation, la réservation est automatiquement annulée.
              </Text>
            </View>

            <Text style={s.sectionTitle}>Moyen de paiement</Text>
            <View style={s.methodsRow}>
              {effectiveMethods.map(m => {
                const key: PayMethod = m === 'wave' ? 'wave' : 'orange_money';
                const on = payMethod === key;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.methodCard, on && s.methodCardOn]}
                    onPress={() => setPayMethod(key)}
                    activeOpacity={0.8}
                  >
                    <Image source={m === 'wave' ? WAVE_LOGO : OM_LOGO} style={s.methodLogo} resizeMode="cover" />
                    <Text style={[s.methodLabel, on && s.methodLabelOn]}>
                      {m === 'wave' ? 'Wave' : 'Orange Money'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmBtnTxt}>Payer {TOTAL.toLocaleString('fr-FR')} FCFA et réserver</Text>
              }
            </TouchableOpacity>

            <Text style={s.legalNote}>
              En confirmant, vous acceptez que l'acompte soit remboursé si le restaurant refuse votre demande.
            </Text>
          </>
        )}

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryKey}>{label}</Text>
      <Text style={[s.summaryVal, accent && s.summaryValAccent]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
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
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  headerSub:   { color: colors.muted, fontFamily: fonts.ui,    fontSize: 12, marginTop: 1 },
  stepBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 12 },

  content: { paddingHorizontal: 18, paddingTop: 20 },

  sectionTitle: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  stepHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginBottom: 6, marginTop: -4 },

  hScroll: { marginBottom: 4 },

  dateChip: {
    width: 62, paddingVertical: 10, marginRight: 10,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center',
  },
  dateChipOn: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  dateDay:    { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
  dateNum:    { color: colors.white, fontFamily: fonts.title, fontSize: 20, marginVertical: 2 },
  dateMon:    { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
  dateOn:     { color: colors.accent },

  slotsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  slotChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    minWidth: 92,
  },
  slotChipOn:  { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  slotLabel:   { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  slotLabelOn: { color: colors.accent },

  emptyBox: { alignItems: 'center', padding: 24, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  emptyTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },

  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 24, justifyContent: 'center', paddingVertical: 8 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 22 },
  counterVal:    { color: colors.white, fontFamily: fonts.title, fontSize: 32, minWidth: 50, textAlign: 'center' },

  summaryCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 14, backgroundColor: colors.surface, gap: 8,
  },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryKey:      { color: colors.muted,  fontFamily: fonts.ui,    fontSize: 12, flex: 1 },
  summaryVal:      { color: colors.white,  fontFamily: fonts.ui,    fontSize: 12, textAlign: 'right', flex: 1 },
  summaryValAccent:{ color: colors.accent, fontFamily: fonts.title, fontSize: 15 },
  summaryDivider:  { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  noticeBox: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
  },
  noticeTxt:    { color: colors.white, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 21 },
  noticeStrong: { color: colors.accent, fontFamily: fonts.title, fontSize: 13.5 },

  methodsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  methodCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, gap: 6,
  },
  methodCardOn:  { borderColor: colors.accent },
  methodLogo:    { width: 48, height: 48, borderRadius: 8 },
  methodLabel:   { color: colors.muted,  fontFamily: fonts.ui, fontSize: 12 },
  methodLabelOn: { color: colors.accent },

  confirmBtn: {
    height: 56, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  confirmBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
  legalNote: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    textAlign: 'center', marginTop: 10, lineHeight: 16,
  },

  nextBtn: {
    height: 50, borderRadius: 10,
    borderWidth: 1, borderColor: colors.accent,
    backgroundColor: `${colors.accent}15`,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  nextBtnTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
});
