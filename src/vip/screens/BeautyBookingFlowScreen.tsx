import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import { calculerPrixClientVip } from '../../config/payment';
import { VipCategorie, VipPrestation } from '../../types/vip';
import { BeautyTimeSlot } from '../../types/beautyAppointment';
import {
  getVipPrestationsPublic,
  getBeautySlots,
  createBeautyAppointment,
} from '../../services/beautyAppointments';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function next14Days(): Date[] {
  const days: Date[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  vipProfilId: string;
  vipNom: string;
  categorie: VipCategorie;
  onBack: () => void;
  onSuccess: (appointmentId: string) => void;
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function BeautyBookingFlowScreen({
  vipProfilId, vipNom, categorie, onBack, onSuccess,
}: Props) {
  const titreFlow = categorie === 'coiffure' ? 'Prendre rendez-vous' : 'Prendre rendez-vous';

  // Données
  const [prestations, setPrestations]     = useState<VipPrestation[]>([]);
  const [slots, setSlots]                 = useState<BeautyTimeSlot[]>([]);
  const [loadingPrestations, setLoadPrest]= useState(true);
  const [loadingSlots, setLoadSlots]      = useState(false);

  // Sélections
  const [selectedPrestation, setPrestation] = useState<VipPrestation | null>(null);
  const [noteClient, setNoteClient]         = useState('');
  const [selectedDate, setSelectedDate]     = useState<Date>(new Date());
  const [selectedSlot, setSlot]             = useState<BeautyTimeSlot | null>(null);
  const [step, setStep]                     = useState(1);
  const [loading, setLoading]               = useState(false);

  const jours = next14Days();

  // Charger prestations
  useEffect(() => {
    getVipPrestationsPublic(vipProfilId)
      .then(setPrestations)
      .catch(() => {})
      .finally(() => setLoadPrest(false));
  }, [vipProfilId]);

  // Charger créneaux quand la date change
  const chargerSlots = useCallback(async (date: Date) => {
    setLoadSlots(true);
    setSlot(null);
    try {
      const data = await getBeautySlots(vipProfilId, toDateStr(date));
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setLoadSlots(false);
    }
  }, [vipProfilId]);

  useEffect(() => {
    if (step >= 2) chargerSlots(selectedDate);
  }, [step, selectedDate, chargerSlots]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      const result = await createBeautyAppointment({
        vipProfilId,
        timeSlotId:    selectedSlot.id,
        dateRdv:       toDateStr(selectedDate),
        heureDebut:    selectedSlot.heure_debut,
        heureFin:      selectedSlot.heure_fin,
        prestationNom: selectedPrestation?.nom,
        noteClient:    noteClient.trim() || undefined,
      });
      onSuccess(result.appointmentId);
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      {/* En-tête */}
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{titreFlow}</Text>
          <Text style={s.headerSub}>{vipNom}</Text>
        </View>
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeTxt}>{step}/3</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── ÉTAPE 1 : Prestation + Note ──────────────────────────────────── */}
        {step >= 1 && (
          <>
            <Text style={s.sectionTitle}>Choisissez une prestation</Text>
            {loadingPrestations ? (
              <ActivityIndicator color={r.couleur.or} style={{ marginVertical: 16 }} />
            ) : prestations.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>Aucune prestation disponible.</Text>
              </View>
            ) : (
              <View style={s.prestationsListe}>
                {prestations.map(p => {
                  const sel = selectedPrestation?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.prestCard, sel && s.prestCardOn]}
                      onPress={() => setPrestation(sel ? null : p)}
                      activeOpacity={0.82}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.prestNom, sel && s.prestNomOn]} numberOfLines={1}>{p.nom}</Text>
                        {p.section && p.section !== 'Carte' && (
                          <Text style={s.prestSection}>{p.section}</Text>
                        )}
                        {p.description ? (
                          <Text style={s.prestDesc} numberOfLines={2}>{p.description}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.prestPrix, sel && s.prestPrixOn]}>
                          {calculerPrixClientVip(p.prix).toLocaleString('fr-FR')} F
                        </Text>
                        {p.prixBarre != null && (
                          <Text style={s.prestBarre}>{calculerPrixClientVip(p.prixBarre).toLocaleString('fr-FR')} F</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={s.sectionTitle}>Message (optionnel)</Text>
            <TextInput
              style={s.textInput}
              placeholder="Ex : cheveux longs, allergie au henné, souhait particulier…"
              placeholderTextColor={r.couleur.gris}
              value={noteClient}
              onChangeText={setNoteClient}
              multiline
              maxLength={500}
            />

            {step === 1 && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Choisir une date et un créneau</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 2 : Date + Créneau ─────────────────────────────────────── */}
        {step >= 2 && (
          <>
            <Text style={s.sectionTitle}>Choisissez une date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
              {jours.map((d, i) => {
                const sel = toDateStr(d) === toDateStr(selectedDate);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dateChip, sel && s.dateChipOn]}
                    onPress={() => { setSelectedDate(d); setSlot(null); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dateDayLabel, sel && s.dateDayLabelOn]}>
                      {DAYS_FR[d.getDay()]}
                    </Text>
                    <Text style={[s.dateDayNum, sel && s.dateDayNumOn]}>{d.getDate()}</Text>
                    <Text style={[s.dateMonthLabel, sel && s.dateMonthLabelOn]}>
                      {MONTHS_FR[d.getMonth()]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sectionTitle}>Créneaux disponibles</Text>
            {loadingSlots ? (
              <ActivityIndicator color={r.couleur.or} style={{ marginVertical: 16 }} />
            ) : slots.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTxt}>Aucun créneau disponible ce jour.</Text>
                <Text style={s.emptyTxt}>Choisissez une autre date.</Text>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map(sl => {
                  const sel = selectedSlot?.id === sl.id;
                  return (
                    <TouchableOpacity
                      key={sl.id}
                      style={[s.slotChip, sel && s.slotChipOn]}
                      onPress={() => setSlot(sl)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.slotLabel, sel && s.slotLabelOn]}>{sl.label}</Text>
                      <Text style={[s.slotTime, sel && s.slotTimeOn]}>
                        {sl.heure_debut} – {sl.heure_fin}
                      </Text>
                      {(sl.dispo ?? 0) > 1 && (
                        <Text style={[s.slotDispo, sel && s.slotDispoOn]}>
                          {sl.dispo} place{sl.dispo! > 1 ? 's' : ''}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 2 && selectedSlot != null && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={s.nextBtnTxt}>Continuer</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ÉTAPE 3 : Récapitulatif + Confirmation ───────────────────────── */}
        {step >= 3 && (
          <>
            <Text style={s.sectionTitle}>Récapitulatif</Text>
            <View style={s.summaryCard}>
              <SummaryRow label="Établissement" value={vipNom} />
              {selectedPrestation && (
                <SummaryRow label="Prestation" value={selectedPrestation.nom} />
              )}
              <SummaryRow
                label="Date"
                value={`${DAYS_FR[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS_FR[selectedDate.getMonth()]}`}
              />
              {selectedSlot && (
                <SummaryRow label="Créneau" value={`${selectedSlot.label} · ${selectedSlot.heure_debut} – ${selectedSlot.heure_fin}`} />
              )}
              {noteClient.trim() !== '' && (
                <SummaryRow label="Votre message" value={noteClient.trim()} />
              )}
              <View style={s.summaryDivider} />
              <Text style={s.summaryNote}>
                Votre demande sera envoyée au salon. Vous recevrez une confirmation ou un refus dans les meilleurs délais.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={r.couleur.encre} />
                : <Text style={s.confirmBtnTxt}>Envoyer la demande</Text>
              }
            </TouchableOpacity>

            <Text style={s.legalNote}>
              Aucun paiement requis. Le salon vous confirmera votre rendez-vous.
            </Text>
          </>
        )}

        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composant ───────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryKey}>{label}</Text>
      <Text style={s.summaryVal}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerSub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 12, marginTop: 1 },
  stepBadge: {
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },

  content: { paddingHorizontal: 18, paddingTop: 20 },

  sectionTitle: {
    color: r.couleur.orClair,
    fontFamily: r.police.util,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },

  // Prestations
  prestationsListe: { gap: 8 },
  prestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
  },
  prestCardOn:  { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  prestNom:     { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 14 },
  prestNomOn:   { color: r.couleur.or },
  prestSection: { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  prestDesc:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12, marginTop: 3 },
  prestPrix:    { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14 },
  prestPrixOn:  { color: r.couleur.or },
  prestBarre:   { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11, textDecorationLine: 'line-through' },

  // Note libre
  textInput: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 8,
    padding: 12,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 13,
    backgroundColor: r.couleur.velours,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Calendrier
  dateScroll:      { marginBottom: 4 },
  dateChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    marginRight: 8,
    minWidth: 56,
  },
  dateChipOn:       { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  dateDayLabel:     { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 10, textTransform: 'uppercase' },
  dateDayLabelOn:   { color: r.couleur.or },
  dateDayNum:       { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 18, marginVertical: 1 },
  dateDayNumOn:     { color: r.couleur.or },
  dateMonthLabel:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 10 },
  dateMonthLabelOn: { color: r.couleur.or },

  // Créneaux
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.velours,
    alignItems: 'center',
    minWidth: 130,
  },
  slotChipOn:   { borderColor: r.couleur.or, backgroundColor: `${r.couleur.or}18` },
  slotLabel:    { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 13 },
  slotLabelOn:  { color: r.couleur.or },
  slotTime:     { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11, marginTop: 3 },
  slotTimeOn:   { color: r.couleur.orClair },
  slotDispo:    { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 10, marginTop: 2 },
  slotDispoOn:  { color: r.couleur.orClair },

  // Vide
  emptyBox: {
    alignItems: 'center', padding: 24,
    borderRadius: 10, borderWidth: 1, borderColor: r.couleur.filetFin,
  },
  emptyTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13, marginBottom: 4 },

  // Récapitulatif
  summaryCard: {
    borderWidth: 1, borderColor: r.couleur.filet,
    borderRadius: 10, padding: 14,
    backgroundColor: r.couleur.velours, gap: 8,
  },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryKey:     { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 12, flex: 1 },
  summaryVal:     { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12, textAlign: 'right', flex: 1.5 },
  summaryDivider: { height: 1, backgroundColor: r.couleur.filetFin, marginVertical: 4 },
  summaryNote: {
    color: r.couleur.gris, fontFamily: r.police.util,
    fontSize: 11, lineHeight: 17, fontStyle: 'italic',
  },

  // Boutons
  nextBtn: {
    height: 50, borderRadius: 10,
    borderWidth: 1, borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}18`,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  nextBtnTxt:  { color: r.couleur.or,     fontFamily: r.police.titre, fontSize: 14 },
  confirmBtn: {
    height: 56, borderRadius: 10,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  confirmBtnTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 15 },
  legalNote: {
    color: r.couleur.gris, fontFamily: r.police.util,
    fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16,
  },
});
