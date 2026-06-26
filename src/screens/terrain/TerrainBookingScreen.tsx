import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { SPORT_EMOJI, Terrain, TerrainHoraire } from '../../types/terrain';
import { getTerrainHoraires, calculerPrixAvecMarge, calculerCommission } from '../../services/terrains';
import { PAYMENT_CONFIG } from '../../config/payment';
import TerrainCreneaux from '../../components/terrain/TerrainCreneaux';
import logger from '../../utils/logger';

// ─── Helpers date ─────────────────────────────────────────────────────────────

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function generateDates(n = 14): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

const DURATIONS: { label: string; value: number }[] = [
  { label: '1h', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h30', value: 150 },
  { label: '3h', value: 180 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingParams {
  terrainId: string;
  terrainNom: string;
  prixHoraire: number;
  prestataireId: string;
  prestataireName: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  dureeHeures: number;
  prixTotal: number;
}

interface Props {
  terrain: Terrain;
  prestataireName: string;
  onBack: () => void;
  onBook: (params: BookingParams) => void;
}

// ─── Ecran ────────────────────────────────────────────────────────────────────

export default function TerrainBookingScreen({ terrain, prestataireName, onBack, onBook }: Props) {
  const DATES = useMemo(() => generateDates(14), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => generateDates(1)[0]);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [horaires, setHoraires] = useState<TerrainHoraire[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ debut: string; fin: string; duree: number } | null>(null);

  useEffect(() => {
    getTerrainHoraires(terrain.id)
      .then(setHoraires)
      .catch(err => logger.warn('[TerrainBooking] horaires:', err));
  }, [terrain.id]);

  // Réinitialise la sélection quand la date ou la durée change
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate, selectedDuration]);

  const dayOfWeek = selectedDate.getDay();
  const horaire = horaires.find(h => h.jour_semaine === dayOfWeek);
  const ferme = !horaire || horaire.ferme;
  const prixBase = Math.round((terrain.prix_horaire * selectedDuration) / 60);
  const prixTotal = calculerPrixAvecMarge(prixBase);
  const commission = calculerCommission(prixTotal);

  const handleBook = () => {
    if (!selectedSlot) return;
    onBook({
      terrainId: terrain.id,
      terrainNom: terrain.nom,
      prixHoraire: terrain.prix_horaire,
      prestataireId: terrain.prestataire_id,
      prestataireName,
      dateReservation: toDateStr(selectedDate),
      heureDebut: selectedSlot.debut,
      heureFin: selectedSlot.fin,
      dureeHeures: selectedSlot.duree,
      prixTotal,
    });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {SPORT_EMOJI[terrain.sport_type]} {terrain.nom}
          </Text>
          <Text style={styles.headerSub}>{prestataireName}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Prix + infos */}
        <View style={styles.infoCard}>
          <Text style={styles.infoPrice}>{formatPrice(calculerPrixAvecMarge(terrain.prix_horaire))} / heure</Text>
          {terrain.capacite > 0 && (
            <Text style={styles.infoSub}>{terrain.capacite} joueurs max</Text>
          )}
          {terrain.description ? (
            <Text style={styles.infoDesc}>{terrain.description}</Text>
          ) : null}
        </View>

        {/* Sélecteur de date */}
        <Text style={styles.secLabel}>Choisir une date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesRow}
        >
          {DATES.map((d, i) => {
            const on = toDateStr(d) === toDateStr(selectedDate);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.datePill, on && styles.datePillOn]}
                onPress={() => setSelectedDate(d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.datePillDay, on && styles.datePillTxtOn]}>
                  {DAYS_FR[d.getDay()]}
                </Text>
                <Text style={[styles.datePillNum, on && styles.datePillTxtOn]}>{d.getDate()}</Text>
                <Text style={[styles.datePillMonth, on && styles.datePillTxtOn]}>
                  {MONTHS_FR[d.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Durée */}
        <Text style={styles.secLabel}>Duree</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map(d => {
            const on = d.value === selectedDuration;
            return (
              <TouchableOpacity
                key={d.value}
                style={[styles.durationChip, on && styles.durationChipOn]}
                onPress={() => setSelectedDuration(d.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.durationTxt, on && styles.durationTxtOn]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Grille des créneaux (avec Realtime) */}
        {ferme ? (
          <View style={styles.fermePill}>
            <Text style={styles.fermeTxt}>Ferme ce jour-la</Text>
          </View>
        ) : horaire ? (
          <TerrainCreneaux
            terrainId={terrain.id}
            horaire={horaire}
            date={toDateStr(selectedDate)}
            dureeMinutes={selectedDuration}
            onSelect={(debut, fin, duree) => setSelectedSlot({ debut, fin, duree })}
          />
        ) : null}

        {/* Récapitulatif */}
        {selectedSlot && (
          <View style={styles.recap}>
            <Text style={styles.recapTitle}>Recapitulatif</Text>
            <Text style={styles.recapLine}>{formatDateLong(selectedDate)}</Text>
            <Text style={styles.recapLine}>
              {selectedSlot.debut} {'→'} {selectedSlot.fin}
            </Text>
            <View style={styles.recapPriceRow}>
              <Text style={styles.recapPriceLabel}>
                {formatPrice(terrain.prix_horaire)} x {selectedSlot.duree}h
              </Text>
              <Text style={styles.recapVal}>{formatPrice(prixBase)}</Text>
            </View>
            <View style={styles.recapSubRow}>
              <Text style={styles.recapPriceLabel}>
                Frais de service LASSİ ({PAYMENT_CONFIG.COMMISSION_PERCENT_DISPLAY})
              </Text>
              <Text style={styles.recapVal}>{formatPrice(commission)}</Text>
            </View>
            <View style={[styles.recapSubRow, styles.recapTotalRow]}>
              <Text style={styles.recapTotalLabel}>Total</Text>
              <Text style={styles.recapPrice}>{formatPrice(prixTotal)}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !selectedSlot && styles.ctaDisabled]}
          onPress={handleBook}
          activeOpacity={0.85}
          disabled={!selectedSlot}
        >
          <Text style={styles.ctaTxt}>
            {selectedSlot
              ? `Reserver - ${formatPrice(prixTotal)}`
              : 'Selectionne un creneau'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  headerSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  infoCard: {
    margin: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16,
  },
  infoPrice: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },
  infoSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  infoDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 8, lineHeight: 18 },

  secLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginHorizontal: 18, marginTop: 16, marginBottom: 10,
  },

  datesRow: { paddingHorizontal: 18, gap: 8 },
  datePill: {
    alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 52,
  },
  datePillOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  datePillDay: { color: colors.muted, fontFamily: fonts.ui, fontSize: 10 },
  datePillNum: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },
  datePillMonth: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  datePillTxtOn: { color: colors.bg },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18 },
  durationChip: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  durationChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  durationTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  durationTxtOn: { color: colors.bg },

  fermePill: {
    marginHorizontal: 18, marginTop: 16,
    backgroundColor: `${colors.danger}18`,
    borderWidth: 1, borderColor: `${colors.danger}40`,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  fermeTxt: { color: colors.danger, fontFamily: fonts.ui, fontSize: 13 },

  recap: {
    margin: 18, marginTop: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 16, gap: 6,
  },
  recapTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 4 },
  recapLine: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapPriceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  recapPriceLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapVal: { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  recapSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  recapTotalRow: {
    marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  recapTotalLabel: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  recapPrice: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  footer: {
    paddingHorizontal: 18, paddingVertical: 12, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  cta: {
    height: 54, borderRadius: radius.lg,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: colors.surface },
  ctaTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
