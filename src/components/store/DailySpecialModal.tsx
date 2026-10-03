import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius } from '../../theme';
import { DailySpecial, getTodaySpecials, addTodaySpecial, deleteTodaySpecialById } from '../../services/dailySpecials';
import { pickImageFromGallery, pickImageFromCamera, uploadImage } from '../../services/storage';

const STORAGE_KEY = (shopId: string) => `@lassi_plat_names:${shopId}`;

async function loadSavedNames(shopId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY(shopId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveName(shopId: string, name: string, existing: string[]): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return existing;
  const next = [trimmed, ...existing.filter(n => n.toLowerCase() !== trimmed.toLowerCase())];
  try { await AsyncStorage.setItem(STORAGE_KEY(shopId), JSON.stringify(next)); } catch {}
  return next;
}

interface Props {
  visible: boolean;
  shopId: string;
  onClose: () => void;
  onChanged: (specials: DailySpecial[]) => void;
}

export default function DailySpecialModal({ visible, shopId, onClose, onChanged }: Props) {
  const [specials, setSpecials]     = useState<DailySpecial[]>([]);
  const [name, setName]             = useState('');
  const [priceStr, setPriceStr]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [photoUri, setPhotoUri]     = useState<string | null>(null);
  const [photoUrl, setPhotoUrl]     = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(''); setPriceStr(''); setPhotoUri(null); setPhotoUrl(null);
    setLoading(true);
    getTodaySpecials(shopId).then(list => { setSpecials(list); setLoading(false); }).catch(() => setLoading(false));
    loadSavedNames(shopId).then(setSavedNames);
  }, [visible, shopId]);

  const price = parseInt(priceStr.replace(/\D/g, ''), 10);
  const canSave = name.trim().length > 0 && price > 0 && !uploading;

  const suggestions = name.trim().length > 0
    ? savedNames.filter(n => n.toLowerCase().includes(name.trim().toLowerCase()) && n.toLowerCase() !== name.trim().toLowerCase())
    : [];

  async function pickPhoto(source: 'gallery' | 'camera') {
    const uri = source === 'gallery'
      ? await pickImageFromGallery()
      : await pickImageFromCamera();
    if (!uri) return;
    setPhotoUri(uri);
    setUploading(true);
    try {
      const path = `daily_specials/${shopId}/${Date.now()}.jpg`;
      const url = await uploadImage('products', uri, path);
      setPhotoUrl(url ?? null);
    } catch {
      Alert.alert('Erreur', "Impossible d'uploader la photo, réessaie.");
      setPhotoUri(null);
      setPhotoUrl(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd() {
    if (!canSave) return;
    setSaving(true);
    try {
      const photo_url = photoUrl ?? undefined;
      const saved = await addTodaySpecial(shopId, { name: name.trim(), price, photo_url });
      const next = [...specials, saved];
      setSpecials(next);
      onChanged(next);
      const nextNames = await saveName(shopId, name.trim(), savedNames);
      setSavedNames(nextNames);
      setName(''); setPriceStr(''); setPhotoUri(null); setPhotoUrl(null);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteTodaySpecialById(id);
      const next = specials.filter(s => s.id !== id);
      setSpecials(next);
      onChanged(next);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de supprimer');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Plats du jour</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>x</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Liste existante */}
            {loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
            ) : specials.length > 0 ? (
              specials.map(item => (
                <View key={item.id} style={styles.specialRow}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.specialName}>{item.name}</Text>
                    <Text style={styles.specialPrice}>{item.price} F</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {deletingId === item.id
                      ? <ActivityIndicator size="small" color="#ff5a5a" />
                      : <Text style={styles.deleteX}>x</Text>}
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Aucun plat du jour aujourd'hui</Text>
            )}

            {/* Formulaire ajout */}
            <View style={styles.divider} />

            {/* Photo */}
            <Text style={styles.label}>Photo (optionnel)</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto('gallery')} disabled={uploading}>
                <Text style={styles.photoBtnTxt}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto('camera')} disabled={uploading}>
                <Text style={styles.photoBtnTxt}>Camera</Text>
              </TouchableOpacity>
              {photoUri && (
                <View style={styles.previewWrap}>
                  {uploading
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Image source={{ uri: photoUri }} style={styles.preview} />}
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => { setPhotoUri(null); setPhotoUrl(null); }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.removePhotoTxt}>x</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.label}>Nom du plat</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Thiébou yapp, Mafe poulet..."
              placeholderTextColor={colors.muted}
              maxLength={120}
            />

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                {suggestions.slice(0, 8).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => setName(s)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.suggestionTxt}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>Prix (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={priceStr}
              onChangeText={v => setPriceStr(v.replace(/\D/g, ''))}
              placeholder="Ex: 2500"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.addBtn, !canSave && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!canSave || saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.bg} />
                : <Text style={styles.addBtnTxt}>+ Ajouter ce plat</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  box: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.white },
  closeBtn: { fontSize: 24, color: colors.muted, lineHeight: 28 },
  specialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  thumbPlaceholder: { backgroundColor: colors.border },
  specialName: { fontFamily: fonts.title, fontSize: 14, color: colors.white },
  specialPrice: { fontFamily: fonts.body, fontSize: 12, color: colors.accent, marginTop: 2 },
  deleteX: { fontSize: 22, color: '#ff5a5a', lineHeight: 26 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginVertical: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, color: colors.white, fontFamily: fonts.body, fontSize: 15 },
  addBtn: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.sm, alignItems: 'center', marginTop: 14 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 15 },
  suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(253,207,52,.12)', borderWidth: 1, borderColor: 'rgba(253,207,52,.35)' },
  suggestionTxt: { color: colors.accent, fontFamily: fonts.body, fontSize: 13 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  photoBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  photoBtnTxt: { color: colors.white, fontFamily: fonts.body, fontSize: 13 },
  previewWrap: { position: 'relative', width: 52, height: 52 },
  preview: { width: 52, height: 52, borderRadius: radius.sm },
  removePhoto: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ff5a5a', alignItems: 'center', justifyContent: 'center' },
  removePhotoTxt: { color: '#fff', fontSize: 11, lineHeight: 13, fontFamily: fonts.ui },
});
