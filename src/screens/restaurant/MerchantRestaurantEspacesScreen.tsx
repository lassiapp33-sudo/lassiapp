import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import {
  getAllStdRestaurantSpaces,
  upsertStdRestaurantSpace,
  deleteRestaurantSpace,
} from '../../services/tableReservations';
import { RestaurantSpace } from '../../types/tableReservation';
import useAuthStore from '../../store/authStore';
import { getErrorMessage } from '../../utils/errorUtils';

interface Props {
  onBack: () => void;
}

const EMPTY: Partial<RestaurantSpace> = { nom: '', description: '', capacite: undefined };

export default function MerchantRestaurantEspacesScreen({ onBack }: Props) {
  const userId    = useAuthStore(s => s.user?.id ?? '');
  const [espaces, setEspaces]     = useState<RestaurantSpace[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<Partial<RestaurantSpace> | null>(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setEspaces(await getAllStdRestaurantSpaces(userId));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing?.nom?.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setSaving(true);
    try {
      await upsertStdRestaurantSpace({
        ...editing,
        prestataire_id: userId,
        nom: editing.nom!,
      });
      setEditing(null);
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (space: RestaurantSpace) => {
    Alert.alert('Supprimer', `Supprimer "${space.nom}" ?`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRestaurantSpace(space.id);
            load();
          } catch (err) {
            Alert.alert('Erreur', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
            stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mes espaces</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setEditing({ ...EMPTY })} activeOpacity={0.8}>
          <Text style={s.addBtnTxt}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {espaces.length === 0 && !editing ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTxt}>Aucun espace configuré.</Text>
              <Text style={s.emptySubTxt}>Ajoutez vos espaces (terrasse, salle, étage...).</Text>
            </View>
          ) : null}

          {espaces.map(sp => (
            <View key={sp.id} style={[s.spaceCard, !sp.actif && s.spaceCardInactive]}>
              <View style={{ flex: 1 }}>
                <Text style={s.spaceName}>{sp.nom}</Text>
                {sp.description ? <Text style={s.spaceDesc}>{sp.description}</Text> : null}
                {sp.capacite != null ? <Text style={s.spaceCap}>Capacité : {sp.capacite} pers.</Text> : null}
              </View>
              <View style={s.spaceActions}>
                <TouchableOpacity onPress={() => setEditing({ ...sp })} hitSlop={8} activeOpacity={0.75}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round">
                    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(sp)} hitSlop={8} activeOpacity={0.75}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#E55C5C" strokeWidth={1.5} strokeLinecap="round">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Formulaire d'édition */}
          {editing && (
            <View style={s.editCard}>
              <Text style={s.editTitle}>{editing.id ? 'Modifier l\'espace' : 'Nouvel espace'}</Text>
              <Text style={s.fieldLabel}>Nom *</Text>
              <TextInput
                style={s.input}
                placeholder="Ex : Terrasse, Salle principale..."
                placeholderTextColor={colors.muted}
                value={editing.nom ?? ''}
                onChangeText={v => setEditing(e => ({ ...e!, nom: v }))}
                maxLength={80}
              />
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Description de l'espace (optionnel)"
                placeholderTextColor={colors.muted}
                value={editing.description ?? ''}
                onChangeText={v => setEditing(e => ({ ...e!, description: v }))}
                maxLength={200}
                multiline
              />
              <Text style={s.fieldLabel}>Capacité (personnes)</Text>
              <TextInput
                style={s.input}
                placeholder="Ex : 20"
                placeholderTextColor={colors.muted}
                value={editing.capacite != null ? String(editing.capacite) : ''}
                onChangeText={v => setEditing(e => ({ ...e!, capacite: v ? Number(v) : undefined }))}
                keyboardType="number-pad"
                maxLength={4}
              />
              <View style={s.editActions}>
                <TouchableOpacity style={s.cancelEditBtn} onPress={() => setEditing(null)} activeOpacity={0.8}>
                  <Text style={s.cancelEditTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={colors.bg} size="small" />
                    : <Text style={s.saveBtnTxt}>Enregistrer</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  addBtn: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 13 },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  emptyBox: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTxt: { color: colors.white,  fontFamily: fonts.title, fontSize: 15 },
  emptySubTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13, textAlign: 'center' },

  spaceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 14, marginBottom: 10,
  },
  spaceCardInactive: { opacity: 0.5 },
  spaceName: { color: colors.white, fontFamily: fonts.title, fontSize: 14 },
  spaceDesc: { color: colors.muted, fontFamily: fonts.ui,    fontSize: 12, marginTop: 2 },
  spaceCap:  { color: colors.muted, fontFamily: fonts.ui,    fontSize: 11, marginTop: 2 },
  spaceActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },

  editCard: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 12,
    backgroundColor: `${colors.accent}08`, padding: 16, marginTop: 12, gap: 8,
  },
  editTitle:  { color: colors.accent, fontFamily: fonts.title, fontSize: 15, marginBottom: 4 },
  fieldLabel: { color: colors.muted,  fontFamily: fonts.ui,    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 12, color: colors.white, fontFamily: fonts.ui, fontSize: 14,
    backgroundColor: colors.bg,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelEditBtn: {
    flex: 1, height: 44, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelEditTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  saveBtn: {
    flex: 2, height: 44, borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 14 },
});
