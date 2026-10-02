import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius } from '../../theme';
import { DailySpecial, getTodaySpecials, addTodaySpecial, deleteTodaySpecialById } from '../../services/dailySpecials';

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

  useEffect(() => {
    if (!visible) return;
    setName(''); setPriceStr('');
    setLoading(true);
    getTodaySpecials(shopId).then(list => { setSpecials(list); setLoading(false); }).catch(() => setLoading(false));
    loadSavedNames(shopId).then(setSavedNames);
  }, [visible, shopId]);

  const price = parseInt(priceStr.replace(/\D/g, ''), 10);
  const canSave = name.trim().length > 0 && price > 0;

  const suggestions = name.trim().length > 0
    ? savedNames.filter(n => n.toLowerCase().includes(name.trim().toLowerCase()) && n.toLowerCase() !== name.trim().toLowerCase())
    : [];

  async function handleAdd() {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await addTodaySpecial(shopId, { name: name.trim(), price });
      const next = [...specials, saved];
      setSpecials(next);
      onChanged(next);
      const nextNames = await saveName(shopId, name.trim(), savedNames);
      setSavedNames(nextNames);
      setName(''); setPriceStr('');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
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
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Plats du jour</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Liste existante */}
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : specials.length > 0 ? (
            <FlatList
              data={specials}
              keyExtractor={s => s.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.specialRow}>
                  <View style={{ flex: 1 }}>
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
                      : <Text style={styles.deleteX}>×</Text>}
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : (
            <Text style={styles.empty}>Aucun plat du jour aujourd'hui</Text>
          )}

          {/* Formulaire ajout */}
          <View style={styles.divider} />
          <Text style={styles.label}>Nom du plat</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Thiébou yapp, Mafé poulet..."
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  box: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.white },
  closeBtn: { fontSize: 24, color: colors.muted, lineHeight: 28 },
  specialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
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
});
