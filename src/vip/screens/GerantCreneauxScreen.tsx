import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import useGerantStore from '../../store/gerantStore';
import {
  getRestaurantTimeSlots,
  upsertTimeSlot,
  deleteTimeSlot,
} from '../../services/tableReservations';
import type { RestaurantTimeSlot } from '../../types/tableReservation';
import { getErrorMessage } from '../../utils/errorUtils';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const IcoClock = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" stroke="#FDCF34" strokeWidth={1.2} fill="#FDCF3440"/>
    <Path d="M12 2.5v1.5M12 20v1.5M2.5 12h1.5M20 12h1.5" stroke="#FDCF34" strokeWidth={1.2} strokeLinecap="round"/>
    <Path d="M12 7v5l3.5 2" stroke="#FDCF34" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="12" cy="12" r="1" fill="#FDCF34"/>
  </Svg>
);

// ─── Jours de la semaine ──────────────────────────────────────────────────────
// 0=Dim, 1=Lun, …, 6=Sam (convention EXTRACT(DOW))

const JOURS: { code: number; court: string; long: string }[] = [
  { code: 0, court: 'Dim', long: 'Dimanche' },
  { code: 1, court: 'Lun', long: 'Lundi' },
  { code: 2, court: 'Mar', long: 'Mardi' },
  { code: 3, court: 'Mer', long: 'Mercredi' },
  { code: 4, court: 'Jeu', long: 'Jeudi' },
  { code: 5, court: 'Ven', long: 'Vendredi' },
  { code: 6, court: 'Sam', long: 'Samedi' },
];

const TOUS_JOURS = JOURS.map(j => j.code);

function formatJours(codes: number[]): string {
  if (codes.length === 7) return 'Tous les jours';
  const ordered = [...codes].sort((a, b) => a - b);
  return ordered.map(c => JOURS.find(j => j.code === c)?.court ?? '').join(', ');
}

function formatHeure(hm: string): string {
  // "HH:MM:SS" → "HH:MM"
  return hm.slice(0, 5);
}

// ─── Validation heure HH:MM ───────────────────────────────────────────────────

function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// ─── Formulaire d'un créneau ──────────────────────────────────────────────────

interface SlotForm {
  label: string;
  heure_debut: string;
  heure_fin: string;
  jours_semaine: number[];
  actif: boolean;
}

const EMPTY_FORM: SlotForm = {
  label: '',
  heure_debut: '12:00',
  heure_fin: '14:00',
  jours_semaine: TOUS_JOURS,
  actif: true,
};

// ─── Petites tuiles raccourcis ─────────────────────────────────────────────────

const PRESETS: { label: string; debut: string; fin: string; jours: number[] }[] = [
  { label: 'Déjeuner',    debut: '12:00', fin: '14:30', jours: [1,2,3,4,5] },
  { label: 'Dîner',       debut: '19:30', fin: '22:00', jours: TOUS_JOURS },
  { label: 'Brunch WE',   debut: '10:00', fin: '13:00', jours: [0,6] },
  { label: 'Soirée',      debut: '20:00', fin: '23:30', jours: [4,5,6] },
  { label: 'Petit-déj',   debut: '07:30', fin: '10:30', jours: TOUS_JOURS },
  { label: 'Midi WE',     debut: '11:30', fin: '15:00', jours: [0,6] },
  { label: 'Happy Hour',  debut: '17:00', fin: '19:30', jours: [1,2,3,4,5] },
  { label: 'Apéritif',    debut: '18:30', fin: '20:30', jours: TOUS_JOURS },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function GerantCreneauxScreen({ onBack }: Props) {
  const profil = useGerantStore(s => s.profil);
  const vipProfilId = profil?.id ?? '';

  const [slots, setSlots]         = useState<RestaurantTimeSlot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<RestaurantTimeSlot | null>(null);
  const [form, setForm]           = useState<SlotForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    if (!vipProfilId) return;
    setLoading(true);
    try {
      const data = await getRestaurantTimeSlots(vipProfilId);
      setSlots(data);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [vipProfilId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = (preset?: typeof PRESETS[0]) => {
    setEditing(null);
    setForm(preset
      ? { label: preset.label, heure_debut: preset.debut, heure_fin: preset.fin, jours_semaine: preset.jours, actif: true }
      : EMPTY_FORM
    );
    setModalOpen(true);
  };

  const openEdit = (slot: RestaurantTimeSlot) => {
    setEditing(slot);
    setForm({
      label:         slot.label,
      heure_debut:   formatHeure(slot.heure_debut),
      heure_fin:     formatHeure(slot.heure_fin),
      jours_semaine: slot.jours_semaine,
      actif:         slot.actif,
    });
    setModalOpen(true);
  };

  const toggleJour = (code: number) => {
    setForm(f => {
      const current = f.jours_semaine;
      if (current.includes(code)) {
        if (current.length === 1) return f;
        return { ...f, jours_semaine: current.filter(c => c !== code) };
      }
      return { ...f, jours_semaine: [...current, code] };
    });
  };

  const setTousJours = () => setForm(f => ({ ...f, jours_semaine: TOUS_JOURS }));

  const handleSave = async () => {
    if (!form.label.trim()) { Alert.alert('Libellé requis'); return; }
    if (!isValidTime(form.heure_debut)) { Alert.alert('Heure de début invalide', 'Format attendu : HH:MM'); return; }
    if (!isValidTime(form.heure_fin))   { Alert.alert('Heure de fin invalide',   'Format attendu : HH:MM'); return; }
    if (form.heure_fin <= form.heure_debut) { Alert.alert('L\'heure de fin doit être après l\'heure de début'); return; }
    if (form.jours_semaine.length === 0) { Alert.alert('Sélectionnez au moins un jour'); return; }

    setSaving(true);
    try {
      await upsertTimeSlot({
        ...(editing ? { id: editing.id } : {}),
        vip_profil_id: vipProfilId,
        label:         form.label.trim(),
        heure_debut:   form.heure_debut,
        heure_fin:     form.heure_fin,
        jours_semaine: form.jours_semaine,
        actif:         form.actif,
        position:      editing?.position ?? slots.length,
      });
      setModalOpen(false);
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (slot: RestaurantTimeSlot) => {
    Alert.alert(
      'Supprimer ce créneau ?',
      `"${slot.label}" ne sera plus proposé à la réservation.`,
      [
        { text: 'Annuler', style: 'cancel' },
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
      ]
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
          <IcoBack />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Mes créneaux</Text>
          <Text style={s.headerSub}>Déjeuner, dîner, brunch…</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => openCreate()} activeOpacity={0.8}>
          <IcoPlus />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={r.couleur.or} size="large" />
        </View>
      ) : slots.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyContainer}>
          <IcoClock />
          <Text style={s.emptyTitle}>Aucun créneau configuré</Text>
          <Text style={s.emptySub}>Définissez vos plages horaires pour que vos clients puissent choisir l'heure de leur réservation.</Text>

          <Text style={s.presetTitle}>Démarrer avec un modèle</Text>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.label} style={s.presetCard} onPress={() => openCreate(p)} activeOpacity={0.85}>
              <Text style={s.presetLabel}>{p.label}</Text>
              <Text style={s.presetDetail}>{p.debut} – {p.fin} · {formatJours(p.jours)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={s.emptyAddBtn} onPress={() => openCreate()} activeOpacity={0.85}>
            <Text style={s.emptyAddTxt}>Créer un créneau personnalisé</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {/* Modèles rapides */}
          <Text style={s.sectionHint}>Modèles rapides</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              {PRESETS.map(p => (
                <TouchableOpacity key={p.label} style={s.presetChip} onPress={() => openCreate(p)} activeOpacity={0.8}>
                  <Text style={s.presetChipTxt}>+ {p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {slots.map(slot => (
            <View key={slot.id} style={[s.card, !slot.actif && s.cardInactif]}>
              <View style={s.cardLeft}>
                <Text style={s.cardHeure}>{formatHeure(slot.heure_debut)} – {formatHeure(slot.heure_fin)}</Text>
                <Text style={s.cardLabel}>{slot.label}</Text>
                <Text style={s.cardJours}>{formatJours(slot.jours_semaine)}</Text>
              </View>
              <View style={s.cardRight}>
                {!slot.actif && <Text style={s.inactifBadge}>Inactif</Text>}
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(slot)} activeOpacity={0.8}>
                    <Text style={s.editBtnTxt}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(slot)} activeOpacity={0.8}>
                    <Text style={s.deleteBtnTxt}>Suppr.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Modal création / édition */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={s.overlay} onPress={() => setModalOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={s.sheet} onStartShouldSetResponder={() => true}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.sheetTitle}>{editing ? 'Modifier le créneau' : 'Nouveau créneau'}</Text>

                <Text style={s.fieldLabel}>Libellé *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex : Déjeuner, Dîner romantique"
                  placeholderTextColor={r.couleur.gris}
                  value={form.label}
                  onChangeText={v => setForm(f => ({ ...f, label: v }))}
                  maxLength={60}
                />

                {/* Heures */}
                <View style={s.heuresRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Heure début *</Text>
                    <TextInput
                      style={s.input}
                      placeholder="HH:MM"
                      placeholderTextColor={r.couleur.gris}
                      value={form.heure_debut}
                      onChangeText={v => setForm(f => ({ ...f, heure_debut: v }))}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <View style={s.heuresSep}>
                    <Text style={s.heuresSepTxt}>→</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Heure fin *</Text>
                    <TextInput
                      style={s.input}
                      placeholder="HH:MM"
                      placeholderTextColor={r.couleur.gris}
                      value={form.heure_fin}
                      onChangeText={v => setForm(f => ({ ...f, heure_fin: v }))}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                </View>

                {/* Jours de la semaine */}
                <Text style={s.fieldLabel}>Jours de la semaine *</Text>
                <View style={s.joursRow}>
                  {JOURS.map(j => {
                    const selected = form.jours_semaine.includes(j.code);
                    return (
                      <TouchableOpacity
                        key={j.code}
                        style={[s.jourChip, selected && s.jourChipSel]}
                        onPress={() => toggleJour(j.code)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.jourChipTxt, selected && s.jourChipTxtSel]}>{j.court}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity onPress={setTousJours} style={s.tousBtn} activeOpacity={0.75}>
                  <Text style={s.tousBtnTxt}>Tous les jours</Text>
                </TouchableOpacity>

                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Créneau actif</Text>
                  <Switch
                    value={form.actif}
                    onValueChange={v => setForm(f => ({ ...f, actif: v }))}
                    thumbColor={form.actif ? r.couleur.orLassi : r.couleur.gris}
                    trackColor={{ true: `${r.couleur.orLassi}40`, false: r.couleur.filet }}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={r.couleur.encre} />
                    : <Text style={s.saveBtnTxt}>{editing ? 'Enregistrer' : 'Créer le créneau'}</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)} activeOpacity={0.8}>
                  <Text style={s.cancelBtnTxt}>Annuler</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: r.couleur.encre },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filet,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 8,
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15 },
  headerSub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 11, marginTop: 1 },
  addBtn: {
    width: 40, height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { padding: 24, gap: 10, alignItems: 'center' },
  emptyTitle:    { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 16 },
  emptySub:      { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  presetTitle:   { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 8, alignSelf: 'flex-start' },
  presetCard: {
    width: '100%',
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  presetLabel:  { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14 },
  presetDetail: { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 12 },
  emptyAddBtn:  {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}14`,
  },
  emptyAddTxt:  { color: r.couleur.or, fontFamily: r.police.titre, fontSize: 14 },

  content: { padding: 16 },

  sectionHint: {
    color: r.couleur.orClair,
    fontFamily: r.police.util,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}0E`,
  },
  presetChipTxt: { color: r.couleur.or, fontFamily: r.police.util, fontSize: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardInactif: { opacity: 0.55 },
  cardLeft:  { flex: 1, gap: 3 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardHeure: { color: r.couleur.or,    fontFamily: r.police.titre, fontSize: 15 },
  cardLabel: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 12 },
  cardJours: { color: r.couleur.gris,   fontFamily: r.police.util, fontSize: 11 },
  inactifBadge: {
    color: r.couleur.gris,
    fontFamily: r.police.util,
    fontSize: 10,
    borderWidth: 1,
    borderColor: r.couleur.gris,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardActions: { flexDirection: 'row', gap: 6 },
  editBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}12`,
  },
  editBtnTxt:   { color: r.couleur.or,   fontFamily: r.police.util, fontSize: 11 },
  deleteBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#E55C5C', backgroundColor: 'rgba(229,92,92,0.08)' },
  deleteBtnTxt: { color: '#E55C5C', fontFamily: r.police.util, fontSize: 11 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: r.couleur.velours,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: r.couleur.filet,
    padding: 20,
    maxHeight: '92%',
  },
  sheetTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 15, marginBottom: 16 },

  fieldLabel: {
    color: r.couleur.orClair,
    fontFamily: r.police.util,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 8,
    padding: 12,
    color: r.couleur.ivoire,
    fontFamily: r.police.util,
    fontSize: 13,
    backgroundColor: r.couleur.encre,
  },

  heuresRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  heuresSep:   { paddingBottom: 12 },
  heuresSepTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 14 },

  joursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  jourChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    backgroundColor: r.couleur.encre,
  },
  jourChipSel: {
    borderColor: r.couleur.orLassi,
    backgroundColor: `${r.couleur.orLassi}18`,
  },
  jourChipTxt:    { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 12 },
  jourChipTxtSel: { color: r.couleur.orLassi, fontFamily: r.police.util, fontSize: 12 },

  tousBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: r.couleur.filet,
  },
  tousBtnTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 11 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
  },
  switchLabel: { color: r.couleur.ivoire, fontFamily: r.police.util, fontSize: 13 },

  saveBtn: {
    height: 52,
    borderRadius: 10,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 15 },

  cancelBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  cancelBtnTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 13 },
});
