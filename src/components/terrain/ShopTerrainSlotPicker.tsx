import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Terrain, CreneauPris } from '../../types/terrain';
import { WeekHours, DayKey, DAY_SHORT, formatHour, DEFAULT_WEEK_HOURS } from '../../services/hours';
import { genererCreneaux, isCreneauDisponible } from '../../services/terrains';
import { colors, fonts, radius } from '../../theme';
import { formatPrice } from '../../utils/format';

const SLOT_MIN = 30;
const BOOKING_MIN = 90; // 1h30

const JS_DAY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function addMin(hhmm: string, minutes: number): string {
  const t = toMin(hhmm) + minutes;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SlotBookParams {
  terrain: Terrain;
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
  openingHours: WeekHours;
  onBook: (p: SlotBookParams) => void;
}

export default function ShopTerrainSlotPicker({ terrain, prestataireName, openingHours, onBook }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const [dayIdx, setDayIdx] = useState(0);
  const [pris, setPris] = useState<CreneauPris[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const selDate = isoDate(days[dayIdx]);
  const selDayKey = JS_DAY[days[dayIdx].getDay()];
  const effectiveHours: WeekHours = { ...DEFAULT_WEEK_HOURS, ...openingHours };
  const dayHours = effectiveHours[selDayKey];

  const fetchPris = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reservations_terrain')
        .select('heure_debut, heure_fin')
        .eq('terrain_id', terrain.id)
        .eq('date_reservation', selDate)
        .in('statut', ['paye', 'en_attente']);
      setPris((data ?? []) as CreneauPris[]);
    } catch {
      setPris([]);
    } finally {
      setLoading(false);
    }
  }, [terrain.id, selDate]);

  useEffect(() => {
    setPicked(null);
    fetchPris();

    chanRef.current?.unsubscribe();
    const ch = supabase
      .channel(`shop-slots-${terrain.id}-${selDate}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations_terrain',
        filter: `terrain_id=eq.${terrain.id}`,
      }, () => fetchPris())
      .subscribe();
    chanRef.current = ch;

    return () => { ch.unsubscribe(); };
  }, [terrain.id, selDate, fetchPris]);

  // Slots de 30 min sur la journée entière
  const allSlots = !dayHours.closed
    ? genererCreneaux(dayHours.open, dayHours.close, SLOT_MIN)
    : [];

  const isAvail = (debut: string): boolean => {
    const fin = addMin(debut, BOOKING_MIN);
    // Le créneau de 1h30 doit tenir dans les horaires d'ouverture
    if (toMin(fin) > toMin(dayHours.close)) return false;
    return isCreneauDisponible(debut, fin, pris);
  };

  const pickSlot = (debut: string) => {
    if (!isAvail(debut)) return;
    setPicked(p => (p === debut ? null : debut));
  };

  const handleBook = () => {
    if (!picked) return;
    const heureFin = addMin(picked, BOOKING_MIN);
    onBook({
      terrain,
      prestataireName,
      dateReservation: selDate,
      heureDebut: picked,
      heureFin,
      dureeHeures: 1.5,
      prixTotal: Math.round(terrain.prix_horaire * 1.5),
    });
  };

  return (
    <View style={styles.root}>

      {/* Sélection de la date */}
      <Text style={styles.heading}>Choisir une date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysRow}
      >
        {days.map((d, i) => {
          const active = i === dayIdx;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, active && styles.dayChipOn]}
              onPress={() => setDayIdx(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayLbl, active && styles.dayLblOn]}>
                {i === 0 ? 'Auj.' : DAY_SHORT[JS_DAY[d.getDay()]]}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayNumOn]}>
                {d.getDate()} {MONTHS_FR[d.getMonth()]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grille des créneaux */}
      <Text style={styles.heading}>Créneaux disponibles</Text>
      <Text style={styles.sub}>Réservation de 1h30 · Choisissez votre heure de début</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
      ) : dayHours.closed ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTxt}>Fermé ce jour</Text>
        </View>
      ) : allSlots.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTxt}>Aucun créneau disponible</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {allSlots.map(({ debut }) => {
            const avail = isAvail(debut);
            const sel = debut === picked;
            return (
              <TouchableOpacity
                key={debut}
                style={[styles.slot, !avail && styles.slotTaken, sel && styles.slotSel]}
                onPress={() => pickSlot(debut)}
                activeOpacity={avail ? 0.75 : 1}
                disabled={!avail}
              >
                <Text style={[styles.slotTxt, !avail && styles.slotTxtTaken, sel && styles.slotTxtSel]}>
                  {formatHour(debut)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Récapitulatif de la réservation choisie */}
      {picked && (
        <View style={styles.recap}>
          <View style={styles.recapRow}>
            <Text style={styles.recapLbl}>Créneau</Text>
            <Text style={styles.recapVal}>
              {formatHour(picked)} → {formatHour(addMin(picked, BOOKING_MIN))}
            </Text>
          </View>
          <View style={styles.recapRow}>
            <Text style={styles.recapLbl}>Durée</Text>
            <Text style={styles.recapVal}>1h30</Text>
          </View>
          <View style={styles.recapRow}>
            <Text style={styles.recapLbl}>Prix</Text>
            <Text style={[styles.recapVal, styles.recapGold]}>
              {formatPrice(Math.round(terrain.prix_horaire * 1.5))}
            </Text>
          </View>
          <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.85}>
            <Text style={styles.bookBtnTxt}>Réserver ce créneau</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingBottom: 24 },

  heading: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 15,
    marginTop: 20,
    marginBottom: 10,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },

  daysRow: { gap: 8, paddingBottom: 4 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 64,
  },
  dayChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayLbl: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
  dayLblOn: { color: colors.bg },
  dayNum: { color: colors.white, fontFamily: fonts.title, fontSize: 13, marginTop: 2 },
  dayNumOn: { color: colors.bg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: `${colors.accent}15`,
    borderWidth: 1.5,
    borderColor: `${colors.accent}50`,
    minWidth: 74,
    alignItems: 'center',
  },
  slotTaken: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.45,
  },
  slotSel: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotTxt: { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },
  slotTxtTaken: { color: colors.muted },
  slotTxtSel: { color: colors.bg },

  emptyBox: { paddingVertical: 20, alignItems: 'center' },
  emptyTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  recap: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent}35`,
    padding: 16,
    gap: 10,
  },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLbl: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapVal: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  recapGold: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15 },
  bookBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  bookBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
});
