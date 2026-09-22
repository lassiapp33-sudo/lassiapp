import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { Terrain, SportType, SPORT_EMOJI, SPORT_LABEL } from '../../types/terrain';
import * as terrainsService from '../../services/terrains';
import { pickImageFromGallery, pickImageFromCamera, uploadImage } from '../../services/storage';
import { getCurrentLocation, reverseGeocode } from '../../services/location';
import useAuthStore from '../../store/authStore';
import useShopStore from '../../store/shopStore';
import { getErrorMessage } from '../../utils/errorUtils';

const IcoImage = ({ stroke }: { stroke: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={stroke} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={stroke} />
  </Svg>
);

const IcoCamera = ({ stroke }: { stroke: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={stroke} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={stroke} />
  </Svg>
);

const IcoPin = ({ stroke }: { stroke: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={stroke} />
    <Circle cx={12} cy={10} r={3} stroke={stroke} />
  </Svg>
);

// ─── Constantes ───────────────────────────────────────────────────────────────

const SPORT_TYPES: SportType[] = ['football', 'basketball', 'tennis', 'volleyball', 'autre'];

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface FormState {
  nom: string;
  description: string;
  prixHoraire: string;
  sportType: SportType;
  capacite: string;
  adresse: string;
}

const DEFAULT_FORM: FormState = {
  nom: '', description: '', prixHoraire: '', sportType: 'football',
  capacite: '10', adresse: '',
};

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

  const [images, setImages] = useState<string[]>(terrain?.images ?? []);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    terrain?.latitude != null && terrain?.longitude != null
      ? { latitude: terrain.latitude, longitude: terrain.longitude }
      : null,
  );
  const [locZone, setLocZone] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  const handleCaptureLocation = async () => {
    setLocLoading(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert('GPS indisponible', "Active la localisation pour définir l'emplacement du terrain.");
        return;
      }
      setLocation(coords);
      // Rend le terrain visible sur la carte client (la carte lit la position de la boutique)
      await useShopStore.getState().updateLocation(coords.latitude, coords.longitude);
      const zone = await reverseGeocode(coords.latitude, coords.longitude);
      setLocZone(zone);
      Alert.alert('Position enregistrée ✓', `Ton terrain est localisé à : ${zone}`);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la position. Réessaie.");
    } finally {
      setLocLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const uri = await pickImageFromGallery();
    if (uri) setImages(prev => [...prev, uri]);
  };

  const pickFromCamera = async () => {
    const uri = await pickImageFromCamera();
    if (uri) setImages(prev => [...prev, uri]);
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
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
      // Upload les images locales (URI file://), garder les URLs déjà distantes
      const uploadedImages = await Promise.all(
        images.map(async (uri) => {
          if (uri.startsWith('http')) return uri;
          const path = `terrains/${prestataireId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          return uploadImage('gallery', uri, path);
        }),
      );

      const saved = await terrainsService.saveTerrain({
        id: terrain?.id,
        prestataire_id: prestataireId,
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        prix_horaire: prix,
        sport_type: form.sportType,
        capacite: parseInt(form.capacite, 10) || 10,
        adresse: form.adresse.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        images: uploadedImages,
        actif: true,
      });
      onSaved(saved);
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >

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

        <Text style={styles.fieldLabel}>Prix de la session (FCFA) *</Text>
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

        {/* ── Photos du terrain ─────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Photos du terrain</Text>
        <Text style={styles.sectionSub}>Ajoutez des photos pour attirer plus de clients.</Text>

        <View style={styles.imgPickerRow}>
          <TouchableOpacity style={styles.imgPickBtn} onPress={pickFromGallery} activeOpacity={0.85}>
            <IcoImage stroke={colors.accent} />
            <Text style={styles.imgPickTxt}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgPickBtn} onPress={pickFromCamera} activeOpacity={0.85}>
            <IcoCamera stroke={colors.accent} />
            <Text style={styles.imgPickTxt}>Caméra</Text>
          </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgScroll}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imgThumb}>
                <Image source={{ uri }} style={styles.imgThumbImg} />
                <TouchableOpacity
                  style={styles.imgDel}
                  onPress={() => removeImage(idx)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.imgDelTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Emplacement du terrain ─────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Emplacement</Text>
        <Text style={styles.sectionSub}>
          Définis la position GPS pour que ton terrain apparaisse sur la carte.
        </Text>

        <TouchableOpacity
          style={styles.locBtn}
          onPress={handleCaptureLocation}
          disabled={locLoading}
          activeOpacity={0.85}
        >
          {locLoading
            ? <ActivityIndicator color={colors.accent} />
            : <IcoPin stroke={colors.accent} />
          }
          <Text style={styles.locBtnTxt}>
            {locLoading
              ? 'Localisation…'
              : locZone
                ? `${locZone} — Mettre à jour`
                : location
                  ? 'Position définie — Mettre à jour'
                  : "Définir l'emplacement de mon terrain"}
          </Text>
        </TouchableOpacity>

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

  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, minHeight: 54,
  },
  locBtnTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13, flexShrink: 1 },

  saveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  saveTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 15 },

  imgPickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  imgPickBtn: {
    flex: 1, height: 52,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  imgPickTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  imgScroll: { marginBottom: 8 },
  imgThumb: { width: 88, height: 88, marginRight: 8, borderRadius: radius.sm, overflow: 'visible' },
  imgThumbImg: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.surface },
  imgDel: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  imgDelTxt: { color: colors.white, fontFamily: fonts.titleXL, fontSize: 11 },
});
