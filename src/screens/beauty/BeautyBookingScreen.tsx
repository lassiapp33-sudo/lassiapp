import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { BeautyService } from '../../types/beauty';
import { calculerPrixBeauteAvecMarge, calculerCommissionBeaute } from '../../services/beauty';
import { getOpeningHoursByMerchant } from '../../services/shops';
import { supabase } from '../../lib/supabase';
import { PAYMENT_CONFIG } from '../../config/payment';
import BeautyCreneaux from '../../components/beauty/BeautyCreneaux';
import { DayKey, WeekHours, DEFAULT_WEEK_HOURS } from '../../services/hours';

// ─── Date helpers ──────────────────────────────────────────────────────────────

const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];
const JS_TO_DAY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BeautyBookingParams {
  prestataireId: string;
  prestataireName: string;
  serviceId: string;
  serviceNom: string;
  dateReservation: string;
  heureDebut: string;
  heureFin: string;
  prixTotal: number;
}

interface Props {
  service: BeautyService;
  prestataireId: string;
  prestataireName: string;
  openingHours: WeekHours | null;
  onBack: () => void;
  onBook: (params: BeautyBookingParams) => void;
}

// ─── Écran ─────────────────────────────────────────────────────────────────────

export default function BeautyBookingScreen({
  service, prestataireId, prestataireName, openingHours, onBack, onBook,
}: Props) {
  const DATES = useMemo(() => generateDates(14), []);
  const [selectedDate, setSelectedDate] = useState<Date>(DATES[0]);
  const [selectedSlot, setSelectedSlot] = useState<{ debut: string; fin: string } | null>(null);

  // ── Horaires LIVE ──────────────────────────────────────────────────────────
  // L'horaire du prestataire DÉFINIT les créneaux. On lit toujours l'état actuel
  // en base + on écoute le realtime : toute modif (inscription OU vitrine)
  // s'applique directement aux créneaux, même écran ouvert.
  const [liveHours, setLiveHours]     = useState<WeekHours | null>(openingHours);
  const [manualClose, setManualClose] = useState(false);

  useEffect(() => {
    let alive = true;
    getOpeningHoursByMerchant(prestataireId)
      .then(({ openingHours: h, isManuallyClose }) => {
        if (!alive) return;
        setLiveHours(h);
        setManualClose(isManuallyClose);
      })
      .catch(() => {});

    const channel = supabase
      .channel(`shop-hours-${prestataireId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shops',
        filter: `merchant_id=eq.${prestataireId}`,
      }, payload => {
        const row = payload.new as Record<string, unknown>;
        setLiveHours((row.opening_hours as WeekHours | null) ?? null);
        setManualClose(Boolean(row.is_manually_closed));
        setSelectedSlot(null);
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [prestataireId]);

  const dayKey  = JS_TO_DAY[selectedDate.getDay()];
  const hours   = liveHours ? ({ ...DEFAULT_WEEK_HOURS, ...liveHours } as WeekHours) : DEFAULT_WEEK_HOURS;
  const dayData = hours[dayKey];
  const ferme   = manualClose || !dayData || dayData.closed;

  const prixBase  = service.prix;
  const prixTotal = calculerPrixBeauteAvecMarge(prixBase);
  const commission = calculerCommissionBeaute(prixTotal);

  const handleBook = () => {
    if (!selectedSlot) return;
    onBook({
      prestataireId,
      prestataireName,
      serviceId:        service.id,
      serviceNom:       service.nom,
      dateReservation:  toDateStr(selectedDate),
      heureDebut:       selectedSlot.debut,
      heureFin:         selectedSlot.fin,
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
          <Text style={styles.headerTitle} numberOfLines={1}>{service.nom}</Text>
          <Text style={styles.headerSub}>{prestataireName}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Infos service */}
        <View style={styles.infoCard}>
          {service.image_url ? (
            <Image source={{ uri: service.image_url }} style={styles.infoImg} resizeMode="cover" />
          ) : null}
          <View style={styles.infoBody}>
            <Text style={styles.infoPrice}>{formatPrice(prixTotal)}</Text>
            <Text style={styles.infoDuree}>{service.duree_minutes} min</Text>
            {service.description ? (
              <Text style={styles.infoDesc}>{service.description}</Text>
            ) : null}
          </View>
        </View>

        {/* Sélecteur de date */}
        <Text style={styles.secLabel}>Choisir une date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesRow}>
          {DATES.map((d, i) => {
            const on = toDateStr(d) === toDateStr(selectedDate);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.datePill, on && styles.datePillOn]}
                onPress={() => { setSelectedDate(d); setSelectedSlot(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.datePillDay, on && styles.datePillTxtOn]}>{DAYS_FR[d.getDay()]}</Text>
                <Text style={[styles.datePillNum, on && styles.datePillTxtOn]}>{d.getDate()}</Text>
                <Text style={[styles.datePillMonth, on && styles.datePillTxtOn]}>{MONTHS_FR[d.getMonth()]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Créneaux */}
        {ferme ? (
          <View style={styles.fermePill}>
            <Text style={styles.fermeTxt}>
              {manualClose ? 'Fermé exceptionnellement' : 'Fermé ce jour-là'}
            </Text>
          </View>
        ) : (
          <BeautyCreneaux
            prestataireId={prestataireId}
            heureOuverture={dayData.open}
            heureFermeture={dayData.close}
            dureeMinutes={service.duree_minutes}
            date={toDateStr(selectedDate)}
            onSelect={(debut, fin) => setSelectedSlot({ debut, fin })}
          />
        )}

        {/* Récapitulatif */}
        {selectedSlot && (
          <View style={styles.recap}>
            <Text style={styles.recapTitle}>Récapitulatif</Text>
            <Text style={styles.recapLine}>
              {DAYS_FR[selectedDate.getDay()]} {selectedDate.getDate()} {MONTHS_FR[selectedDate.getMonth()]}
            </Text>
            <Text style={styles.recapLine}>{selectedSlot.debut} → {selectedSlot.fin}</Text>
            <View style={styles.recapPriceRow}>
              <Text style={styles.recapPriceLabel}>Prix de la prestation</Text>
              <Text style={styles.recapVal}>{formatPrice(prixBase)}</Text>
            </View>
            <View style={styles.recapSubRow}>
              <Text style={styles.recapPriceLabel}>
                Frais LASSI ({PAYMENT_CONFIG.COMMISSION_PERCENT_DISPLAY})
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
            {selectedSlot ? `Réserver — ${formatPrice(prixTotal)}` : 'Sélectionne un créneau'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
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
  headerSub:   { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  infoCard: {
    margin: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden',
  },
  infoImg:  { width: '100%', height: 160 },
  infoBody: { padding: 16 },
  infoPrice: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },
  infoDuree: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  infoDesc:  { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 8, lineHeight: 18 },

  secLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginHorizontal: 18, marginTop: 16, marginBottom: 10,
  },

  datesRow:        { paddingHorizontal: 18, gap: 8 },
  datePill:        {
    alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 52,
  },
  datePillOn:      { backgroundColor: colors.accent, borderColor: colors.accent },
  datePillDay:     { color: colors.muted, fontFamily: fonts.ui, fontSize: 10 },
  datePillNum:     { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },
  datePillMonth:   { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
  datePillTxtOn:   { color: colors.bg },

  fermePill: {
    marginHorizontal: 18, marginTop: 16,
    backgroundColor: `${colors.danger}18`, borderWidth: 1, borderColor: `${colors.danger}40`,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  fermeTxt:  { color: colors.danger, fontFamily: fonts.ui, fontSize: 13 },

  recap: {
    margin: 18, marginTop: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 6,
  },
  recapTitle:      { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 4 },
  recapLine:       { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapPriceRow:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  recapPriceLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  recapVal:        { color: colors.white, fontFamily: fonts.ui, fontSize: 13 },
  recapSubRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  recapTotalRow:   { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  recapTotalLabel: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  recapPrice:      { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 18 },

  footer: {
    paddingHorizontal: 18, paddingVertical: 12, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  cta:         {
    height: 54, borderRadius: radius.lg,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: colors.surface },
  ctaTxt:      { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
