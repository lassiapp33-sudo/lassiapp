import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, TouchableOpacity, Platform,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { Terrain, ReservationTerrain, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import { JOURS, calculerPrixAvecMarge } from '../../services/terrains';
import TerrainCreneaux from '../../components/terrain/TerrainCreneaux';
import ReservationModal from '../../components/terrain/ReservationModal';
import ReservationRecu from '../../components/terrain/ReservationRecu';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDates(n = 7): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

const DATES = buildDates(7);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  terrain: Terrain;
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainDetailScreen({ terrain, onBack }: Props) {
  const today = toIso(DATES[0]);
  const [dateSelectionnee, setDateSelectionnee] = useState(today);
  const [selection, setSelection] = useState<{ debut: string; fin: string; duree: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reservation, setReservation] = useState<ReservationTerrain | null>(null);

  // Horaire du jour sélectionné
  const jourSemaine = new Date(dateSelectionnee + 'T12:00').getDay();
  const horaireJour = terrain.horaires?.find(h => h.jour_semaine === jourSemaine) ?? null;

  // Après paiement : affiche le reçu QR
  if (reservation) {
    return (
      <ReservationRecu
        reservation={reservation}
        terrain={terrain}
        onRetour={onBack}
      />
    );
  }

  const prixSelection = selection ? calculerPrixAvecMarge(terrain.prix_horaire * selection.duree) : 0;

  return (
    <View style={styles.root}>
      {/* Header flottant sur l'image */}
      <View style={[styles.headerFloat, { top: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        {terrain.images[0] ? (
          <Image source={{ uri: terrain.images[0] }} style={styles.hero} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroEmoji}>{SPORT_EMOJI[terrain.sport_type]}</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Identite */}
          <View style={styles.identityRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nom}>{terrain.nom}</Text>
              <Text style={styles.sport}>{SPORT_LABEL[terrain.sport_type]}</Text>
              {terrain.adresse ? (
                <Text style={styles.adresse}>{terrain.adresse}</Text>
              ) : null}
            </View>
            <View style={styles.prixBox}>
              <Text style={styles.prix}>{formatPrice(calculerPrixAvecMarge(terrain.prix_horaire))}</Text>
              <Text style={styles.prixSub}>/heure</Text>
            </View>
          </View>

          {terrain.description ? (
            <Text style={styles.desc}>{terrain.description}</Text>
          ) : null}

          {terrain.capacite > 0 && (
            <View style={styles.infoPill}>
              <Text style={styles.infoPillTxt}>👥 {terrain.capacite} joueurs max</Text>
            </View>
          )}

          {/* Sélection date */}
          <Text style={styles.sectionTitle}>Choisir une date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesRow}
          >
            {DATES.map(d => {
              const iso = toIso(d);
              const on = iso === dateSelectionnee;
              return (
                <TouchableOpacity
                  key={iso}
                  style={[styles.dateChip, on && styles.dateChipActive]}
                  onPress={() => { setDateSelectionnee(iso); setSelection(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateJour, on && styles.dateChipTxtOn]}>
                    {JOURS[d.getDay()]}
                  </Text>
                  <Text style={[styles.dateNum, on && styles.dateChipTxtOn]}>
                    {d.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Grille créneaux (Realtime) */}
          {horaireJour && !horaireJour.ferme ? (
            <TerrainCreneaux
              terrainId={terrain.id}
              horaire={horaireJour}
              date={dateSelectionnee}
              onSelect={(debut, fin, duree) => setSelection({ debut, fin, duree })}
            />
          ) : (
            <View style={styles.fermePill}>
              <Text style={styles.fermeTxt}>Ferme ce jour</Text>
            </View>
          )}

          {/* Bouton réserver */}
          {selection && (
            <TouchableOpacity
              style={styles.btn}
              onPress={() => setShowModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                Reserver {selection.debut} → {selection.fin}
                {'  ·  '}
                {formatPrice(prixSelection)}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Platform.OS === 'ios' ? 50 : 30 }} />
        </View>
      </ScrollView>

      {/* Modal paiement */}
      {showModal && selection && (
        <ReservationModal
          visible={showModal}
          terrain={terrain}
          date={dateSelectionnee}
          heureDebut={selection.debut}
          heureFin={selection.fin}
          dureeHeures={selection.duree}
          onClose={() => setShowModal(false)}
          onSuccess={res => { setShowModal(false); setReservation(res); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  headerFloat: {
    position: 'absolute', left: 16, zIndex: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: 'rgba(20,21,42,0.7)',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { width: '100%', height: 220 },
  heroPlaceholder: {
    width: '100%', height: 180,
    backgroundColor: `${colors.accent}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 64 },

  content: { padding: 20 },

  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  nom: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 20, marginBottom: 2 },
  sport: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  adresse: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  prixBox: { alignItems: 'flex-end', paddingTop: 2 },
  prix: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 20 },
  prixSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  desc: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: 12 },

  infoPill: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.success}15`,
    borderWidth: 1, borderColor: `${colors.success}30`,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  infoPillTxt: { color: colors.success, fontFamily: fonts.ui, fontSize: 12 },

  sectionTitle: {
    color: colors.white, fontFamily: fonts.title,
    fontSize: 15, marginBottom: 10, marginTop: 4,
  },
  datesRow: { gap: 8, paddingBottom: 4 },
  dateChip: {
    width: 52, height: 64, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dateChipTxtOn: { color: colors.bg },
  dateJour: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11 },
  dateNum: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 18 },

  fermePill: {
    marginTop: 16, backgroundColor: `${colors.danger}12`,
    borderWidth: 1, borderColor: `${colors.danger}30`,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  fermeTxt: { color: colors.danger, fontFamily: fonts.ui, fontSize: 13 },

  btn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  btnText: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
