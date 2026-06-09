import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Switch,
} from 'react-native';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { Terrain, SportType, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import * as terrainsService from '../../services/terrains';
import useAuthStore from '../../store/authStore';
import logger from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SPORT_TYPES: SportType[] = ['football', 'basketball', 'tennis', 'volleyball', 'autre'];
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface FormState {
  nom: string;
  description: string;
  prixHoraire: string;
  sportType: SportType;
  capacite: string;
  adresse: string;
}

interface HoraireForm {
  jour_semaine: number;
  heure_ouverture: string;
  heure_fermeture: string;
  ferme: boolean;
}

const DEFAULT_FORM: FormState = {
  nom: '', description: '', prixHoraire: '', sportType: 'football',
  capacite: '10', adresse: '',
};

const DEFAULT_HORAIRES: HoraireForm[] = Array.from({ length: 7 }, (_, i) => ({
  jour_semaine: i, heure_ouverture: '08:00', heure_fermeture: '22:00', ferme: false,
}));

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  terrain?: Terrain;
  onBack: () => void;
  onSaved: (t: Terrain) => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function TerrainEditScreen({ terrain, onBack, onSaved }: Props) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');

  const [form, setForm] = useState<FormState>(
    terrain
      ? {
          nom: terrain.nom,
          description: terrain.description ?? '',
          prixHoraire: String(terrain.prix_horaire),
          sportType: terrain.sport_type,
          capacite: String(terrain.capacite),
          adresse: terrain.adresse ?? '',
        }
      : DEFAULT_FORM,
  );

  const [horaires, setHoraires] = useState<HoraireForm[]>(DEFAULT_HORAIRES);
  const [loadingHoraires, setLoadingHoraires] = useState(!!terrain);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!terrain) return;
    terrainsService.getTerrainHoraires(terrain.id)
      .then(data => {
        if (data.length > 0) {
          setHoraires(DEFAULT_HORAIRES.map(dh => {
            const found = data.find(h => h.jour_semaine === dh.jour_semaine);
            return found
              ? { jour_semaine: found.jour_semaine, heure_ouverture: found.heure_ouverture, heure_fermeture: found.heure_fermeture, ferme: found.ferme }
              : dh;
          }));
        }
      })
      .catch(err => logger.warn('[TerrainEditScreen] horaires:', err))
      .finally(() => setLoadingHoraires(false));
  }, [terrain]);

  const updateHoraire = (jour: number, field: keyof HoraireForm, value: string | boolean) => {
    setHoraires(prev => prev.map(h => h.jour_semaine === jour ? { ...h, [field]: value } : h));
  };

  const handleSave = async () => {
    if (!form.nom.trim()) {
      Alert.alert('Champ requis', 'Le nom du terrain est obligatoire.');
      return;
    }
    const prix = parseInt(form.prixHoraire, 10);
    if (!prix || prix <= 0) {
      Alert.alert('Prix invalide', 'Indique un prix horaire valide.');
      return;
    }
    setSaving(true);
    try {
      const saved = await terrainsService.saveTerrain({
        id: terrain?.id,
        prestataire_id: prestataireId,
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        prix_horaire: prix,
        sport_type: form.sportType,
        capacite: parseInt(form.capacite, 10) || 10,
        adresse: form.adresse.trim() || undefined,
        actif: true,
      });
      await terrainsService.saveTerrainHoraires(saved.id, horaires);
      onSaved(saved);
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {terrain ? 'Modifier le terrain' : 'Ajouter un terrain'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Infos terrain ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Informations</Text>

        <Text style={styles.fieldLabel}>Nom *</Text>
        <TextInput
          style={styles.input}
          value={form.nom}
          onChangeText={v => setForm(f => ({ ...f, nom: v }))}
          placeholder="Ex : Terrain principal"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.fieldLabel}>Sport</Text>
        <View style={styles.chipRow}>
          {SPORT_TYPES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, form.sportType === s && styles.chipOn]}
              onPress={() => setForm(f => ({ ...f, sportType: s }))}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipTxt, form.sportType === s && styles.chipTxtOn]}>
                {SPORT_EMOJI[s]} {SPORT_LABEL[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Prix horaire (FCFA) *</Text>
        <TextInput
          style={styles.input}
          value={form.prixHoraire}
          onChangeText={v => setForm(f => ({ ...f, prixHoraire: v.replace(/\D/g, '') }))}
          placeholder="Ex : 5000"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Capacité (joueurs)</Text>
        <TextInput
          style={styles.input}
          value={form.capacite}
          onChangeText={v => setForm(f => ({ ...f, capacite: v.replace(/\D/g, '') }))}
          placeholder="10"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>Adresse</Text>
        <TextInput
          style={styles.input}
          value={form.adresse}
          onChangeText={v => setForm(f => ({ ...f, adresse: v }))}
          placeholder="Ex : Parcelles Assainies, Dakar"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={form.description}
          onChangeText={v => setForm(f => ({ ...f, description: v }))}
          placeholder="Gazon synthétique, vestiaires disponibles…"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />

        {/* ── Horaires d'ouverture ───────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Horaires d'ouverture</Text>
        <Text style={styles.sectionSub}>
          Configurez les créneaux disponibles pour chaque jour.
        </Text>

        {loadingHoraires ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.horairesList}>
            {horaires.map(h => (
              <View key={h.jour_semaine} style={styles.dayRow}>
                <Text style={styles.dayName}>{DAYS_FR[h.jour_semaine]}</Text>

                <Switch
                  value={!h.ferme}
                  onValueChange={v => updateHoraire(h.jour_semaine, 'ferme', !v)}
                  trackColor={{ false: colors.border, true: `${colors.accent}60` }}
                  thumbColor={h.ferme ? colors.surface : colors.accent}
                />

                {h.ferme ? (
                  <Text style={styles.fermeLabel}>Fermé</Text>
                ) : (
                  <View style={styles.timeRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={h.heure_ouverture}
                      onChangeText={v => updateHoraire(h.jour_semaine, 'heure_ouverture', v)}
                      placeholder="08:00"
                      placeholderTextColor={colors.muted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                    <Text style={styles.timeSep}>—</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={h.heure_fermeture}
                      onChangeText={v => updateHoraire(h.jour_semaine, 'heure_fermeture', v)}
                      placeholder="22:00"
                      placeholderTextColor={colors.muted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.saveTxt}>{terrain ? 'Enregistrer' : 'Créer le terrain'}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 16;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 16, flex: 1 },

  content: { padding: 20, paddingBottom: BOTTOM_PAD },

  sectionLabel: {
    color: colors.white, fontFamily: fonts.title,
    fontSize: 14, marginBottom: 4,
  },
  sectionSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginBottom: 14 },

  fieldLabel: {
    color: colors.muted, fontFamily: fonts.ui, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 16, marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, color: colors.white, fontFamily: fonts.body,
    fontSize: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  chipTxtOn: { color: colors.bg },

  horairesList: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dayName: {
    color: colors.white, fontFamily: fonts.ui, fontSize: 13, width: 72,
  },
  fermeLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, flex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  timeInput: {
    flex: 1, height: 36, backgroundColor: colors.bg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm,
    color: colors.white, fontFamily: fonts.ui, fontSize: 13,
    textAlign: 'center', paddingHorizontal: 8,
  },
  timeSep: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },

  saveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  saveTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },
});
