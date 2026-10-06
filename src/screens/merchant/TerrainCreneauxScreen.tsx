import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Switch,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import useAuthStore from '../../store/authStore';
import * as terrainsService from '../../services/terrains';
import type { Terrain } from '../../types/terrain';

const JOURS_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface JourConfig {
  jour_semaine: number;
  heure_ouverture: string;
  heure_fermeture: string;
  ferme: boolean;
}

const DEFAULT_SCHEDULE: JourConfig[] = JOURS_LABELS.map((_, i) => ({
  jour_semaine: i,
  heure_ouverture: '08:00',
  heure_fermeture: '22:00',
  ferme: i === 0, // dimanche fermé par défaut
}));

function formatHeure(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

const IcoCheck = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M20 6 9 17l-5-5" stroke={colors.bg} />
  </Svg>
);

export default function TerrainCreneauxScreen({ onBack }: { onBack: () => void }) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');
  const [terrains, setTerrains]   = useState<Terrain[]>([]);
  const [schedule, setSchedule]   = useState<JourConfig[]>(DEFAULT_SCHEDULE);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    if (!prestataireId) return;
    setLoading(true);
    try {
      const ts = await terrainsService.getTerrainsByMerchant(prestataireId);
      setTerrains(ts);
      if (ts.length > 0) {
        const horaires = await terrainsService.getTerrainHoraires(ts[0].id);
        if (horaires.length > 0) {
          // Merge fetched horaires over defaults
          const merged = DEFAULT_SCHEDULE.map(def => {
            const h = horaires.find(x => x.jour_semaine === def.jour_semaine);
            return h ? {
              jour_semaine: h.jour_semaine,
              heure_ouverture: h.heure_ouverture,
              heure_fermeture: h.heure_fermeture,
              ferme: h.ferme,
            } : def;
          });
          setSchedule(merged);
        }
      }
    } catch {
      // garde les defaults
    } finally {
      setLoading(false);
    }
  }, [prestataireId]);

  useEffect(() => { load(); }, [load]);

  const updateJour = (idx: number, patch: Partial<JourConfig>) => {
    setSchedule(prev => prev.map((j, i) => i === idx ? { ...j, ...patch } : j));
  };

  const handleSave = async () => {
    if (terrains.length === 0) {
      Alert.alert('Aucun terrain', 'Ajoute d\'abord un terrain avant de définir les créneaux.');
      return;
    }
    setSaving(true);
    try {
      for (const terrain of terrains) {
        await terrainsService.saveTerrainHoraires(terrain.id, schedule);
      }
      Alert.alert(
        'Créneaux enregistrés',
        `Vos disponibilités ont été mises à jour pour ${terrains.length === 1 ? 'votre terrain' : `vos ${terrains.length} terrains`}.`,
        [{ text: 'OK', onPress: onBack }],
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer les créneaux. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes créneaux</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {terrains.length > 1 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoTxt}>
                  Ces créneaux s'appliquent à tous vos terrains ({terrains.length} terrains).
                </Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Disponibilités par jour</Text>
            <Text style={styles.sectionSub}>
              Définissez vos horaires d'ouverture. Les clients pourront réserver des créneaux d'1h30 dans cette plage.
            </Text>

            {schedule.map((jour, idx) => (
              <View key={jour.jour_semaine} style={styles.jourCard}>
                <View style={styles.jourHeader}>
                  <Text style={[styles.jourLabel, jour.ferme && styles.jourLabelFerme]}>
                    {JOURS_LABELS[jour.jour_semaine]}
                  </Text>
                  <View style={styles.jourToggleRow}>
                    <Text style={styles.jourToggleTxt}>{jour.ferme ? 'Fermé' : 'Ouvert'}</Text>
                    <Switch
                      value={!jour.ferme}
                      onValueChange={v => updateJour(idx, { ferme: !v })}
                      trackColor={{ false: colors.surface, true: colors.accent + '60' }}
                      thumbColor={!jour.ferme ? colors.accent : colors.muted}
                    />
                  </View>
                </View>

                {!jour.ferme && (
                  <View style={styles.heuresRow}>
                    <View style={styles.heureBlock}>
                      <Text style={styles.heureLabel}>Ouverture</Text>
                      <TextInput
                        style={styles.heureInput}
                        value={jour.heure_ouverture}
                        onChangeText={v => updateJour(idx, { heure_ouverture: formatHeure(v) })}
                        keyboardType="numeric"
                        maxLength={5}
                        placeholder="08:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <Text style={styles.heureSep}>→</Text>
                    <View style={styles.heureBlock}>
                      <Text style={styles.heureLabel}>Fermeture</Text>
                      <TextInput
                        style={styles.heureInput}
                        value={jour.heure_fermeture}
                        onChangeText={v => updateJour(idx, { heure_fermeture: formatHeure(v) })}
                        keyboardType="numeric"
                        maxLength={5}
                        placeholder="22:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <>
                  <IcoCheck />
                  <Text style={styles.saveBtnTxt}>Enregistrer les créneaux</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.surface,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.white },

  scroll:  { flex: 1 },
  content: { padding: 18, paddingBottom: 8 },

  infoBox: {
    backgroundColor: colors.accent + '18',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 18,
  },
  infoTxt: { fontFamily: fonts.body, fontSize: 13, color: colors.accent },

  sectionLabel: { fontFamily: fonts.title, fontSize: 15, color: colors.white, marginBottom: 4 },
  sectionSub:   { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 16 },

  jourCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  jourHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  jourLabel:      { fontFamily: fonts.title, fontSize: 14, color: colors.white },
  jourLabelFerme: { color: colors.muted },
  jourToggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jourToggleTxt:  { fontFamily: fonts.body, fontSize: 12, color: colors.muted },

  heuresRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 12,
  },
  heureBlock: { flex: 1 },
  heureLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginBottom: 4 },
  heureInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.title,
    fontSize: 15,
    color: colors.white,
    textAlign: 'center',
  },
  heureSep: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, marginTop: 16 },

  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: colors.surface,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { fontFamily: fonts.title, fontSize: 15, color: colors.bg },
});
