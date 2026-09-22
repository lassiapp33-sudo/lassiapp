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
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import {
  getAllStdTimeSlots,
  upsertStdTimeSlot,
  deleteTimeSlot,
} from '../../services/tableReservations';
import { RestaurantTimeSlot } from '../../types/tableReservation';
import useAuthStore from '../../store/authStore';
import { getErrorMessage } from '../../utils/errorUtils';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const TOUS_JOURS = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  onBack: () => void;
}

type EditSlot = {
  id?: string;
  label: string;
  heure_debut: string;
  heure_fin: string;
  jours_semaine: number[];
};

const EMPTY_SLOT: EditSlot = {
  label: '',
  heure_debut: '12:00',
  heure_fin: '14:00',
  jours_semaine: TOUS_JOURS,
};

export default function MerchantRestaurantCreneauxScreen({ onBack }: Props) {
  const userId  = useAuthStore(s => s.user?.id ?? '');
  const [slots, setSlots]     = useState<RestaurantTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditSlot | null>(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setSlots(await getAllStdTimeSlots(userId));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { Alert.alert('Erreur', 'Le label est requis'); return; }
    if (!/^\d{2}:\d{2}$/.test(editing.heure_debut) || !/^\d{2}:\d{2}$/.test(editing.heure_fin)) {
      Alert.alert('Erreur', 'Format heure invalide (HH:MM)'); return;
    }
    if (editing.heure_fin <= editing.heure_debut) {
      Alert.alert('Erreur', 'L\'heure de fin doit être après l\'heure de début'); return;
    }
    setSaving(true);
    try {
      await upsertStdTimeSlot({
        ...(editing.id ? { id: editing.id } : {}),
        prestataire_id: userId,
        label:          editing.label,
        heure_debut:    editing.heure_debut + ':00',
        heure_fin:      editing.heure_fin   + ':00',
        jours_semaine:  editing.jours_semaine,
      });
      setEditing(null);
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (slot: RestaurantTimeSlot) => {
    Alert.alert('Supprimer', `Supprimer le créneau "${slot.label}" ?`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTimeSlot(slot.id);
            load();
          } catch (err) {
            Alert.alert('Erreur', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const toggleJour = (jour: number) => {
    if (!editing) return;
    setEditing(e => ({
      ...e!,
      jours_semaine: e!.jours_semaine.includes(jour)
        ? e!.jours_semaine.filter(j => j !== jour)
        : [...e!.jours_semaine, jour].sort(),
    }));
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
        <Text style={s.headerTitle}>Mes créneaux</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setEditing({ ...EMPTY_SLOT })} activeOpacity={0.8}>
          <Text style={s.addBtnTxt}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {slots.length === 0 && !editing ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTxt}>Aucun créneau configuré.</Text>
              <Text style={s.emptySubTxt}>Ajoutez vos plages horaires (Déjeuner, Dîner...).</Text>
            </View>
          ) : null}

          {slots.map(slot => (
            <View key={slot.id} style={[s.slotCard, !slot.actif && s.slotCardInactive]}>
              <View style={{ flex: 1 }}>
                <Text style={s.slotLabel}>{slot.label}</Text>
                <Text style={s.slotHours}>
                  {slot.heure_debut?.slice(0, 5)} – {slot.heure_fin?.slice(0, 5)}
                </Text>
                <Text style={s.slotJours}>
                  {slot.jours_semaine.map(j => JOURS[j]).join(' · ')}
                </Text>
              </View>
              <View style={s.slotActions}>
                <TouchableOpacity
                  onPress={() => setEditing({
                    id: slot.id,
                    label: slot.label,
                    heure_debut: slot.heure_debut?.slice(0, 5) ?? '12:00',
                    heure_fin:   slot.heure_fin?.slice(0, 5)   ?? '14:00',
                    jours_semaine: slot.jours_semaine,
                  })}
                  hitSlop={8}
                  activeOpacity={0.75}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round">
                    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(slot)} hitSlop={8} activeOpacity={0.75}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#E55C5C" strokeWidth={1.5} strokeLinecap="round">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {editing && (
            <View style={s.editCard}>
              <Text style={s.editTitle}>{editing.id ? 'Modifier le créneau' : 'Nouveau créneau'}</Text>

              <Text style={s.fieldLabel}>Label *</Text>
              <TextInput
                style={s.input}
                placeholder="Ex : Déjeuner, Dîner, Brunch..."
                placeholderTextColor={colors.muted}
                value={editing.label}
                onChangeText={v => setEditing(e => ({ ...e!, label: v }))}
                maxLength={50}
              />

              <View style={s.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Heure début</Text>
                  <TextInput
                    style={s.input}
                    placeholder="12:00"
                    placeholderTextColor={colors.muted}
                    value={editing.heure_debut}
                    onChangeText={v => setEditing(e => ({ ...e!, heure_debut: v }))}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Heure fin</Text>
                  <TextInput
                    style={s.input}
                    placeholder="14:00"
                    placeholderTextColor={colors.muted}
                    value={editing.heure_fin}
                    onChangeText={v => setEditing(e => ({ ...e!, heure_fin: v }))}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <Text style={s.fieldLabel}>Jours disponibles</Text>
              <View style={s.joursRow}>
                {JOURS.map((j, i) => {
                  const sel = editing.jours_semaine.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.jourChip, sel && s.jourChipOn]}
                      onPress={() => toggleJour(i)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.jourChipTxt, sel && s.jourChipTxtOn]}>{j}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

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

  emptyBox:    { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTxt:    { color: colors.white,  fontFamily: fonts.title, fontSize: 15 },
  emptySubTxt: { color: colors.muted,  fontFamily: fonts.ui,    fontSize: 13, textAlign: 'center' },

  slotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 14, marginBottom: 10,
  },
  slotCardInactive: { opacity: 0.5 },
  slotLabel:  { color: colors.white, fontFamily: fonts.title, fontSize: 14, marginBottom: 2 },
  slotHours:  { color: colors.accent, fontFamily: fonts.ui,  fontSize: 13 },
  slotJours:  { color: colors.muted,  fontFamily: fonts.ui,  fontSize: 11, marginTop: 2 },
  slotActions: { flexDirection: 'row', gap: 16 },

  editCard: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 12,
    backgroundColor: `${colors.accent}08`, padding: 16, marginTop: 12, gap: 8,
  },
  editTitle:  { color: colors.accent, fontFamily: fonts.title, fontSize: 15, marginBottom: 4 },
  fieldLabel: { color: colors.muted,  fontFamily: fonts.ui,    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },

  timeRow: { flexDirection: 'row', gap: 10 },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 12, color: colors.white, fontFamily: fonts.ui, fontSize: 14,
    backgroundColor: colors.bg,
  },

  joursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  jourChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  jourChipOn:    { borderColor: colors.accent, backgroundColor: `${colors.accent}20` },
  jourChipTxt:   { color: colors.muted,  fontFamily: fonts.ui, fontSize: 12 },
  jourChipTxtOn: { color: colors.accent },

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
