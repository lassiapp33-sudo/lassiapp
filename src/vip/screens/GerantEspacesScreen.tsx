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
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { royal as r } from '../theme';
import { TOP_INSET } from '../../theme';
import useGerantStore from '../../store/gerantStore';
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '../../lib/supabase';
import {
  getAllRestaurantSpaces,
  upsertRestaurantSpace,
  deleteRestaurantSpace,
} from '../../services/tableReservations';
import type { RestaurantSpace } from '../../types/tableReservation';
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

const IcoCamera = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.gris} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx={12} cy={13} r={4} />
  </Svg>
);

const IcoHouse = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24">
    <Path d="M3 11L12 3l9 8" stroke="#FDCF34" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <Rect x="4" y="11" width="16" height="10" rx="1" stroke="#FDCF34" strokeWidth={1.5} fill="#FDCF3440"/>
    <Rect x="9.5" y="15" width="5" height="6" rx="0.5" stroke="#FDCF34" strokeWidth={1.2} fill="none"/>
    <Rect x="5.5" y="13" width="3" height="3" rx="0.5" stroke="#FDCF34" strokeWidth={1} fill="none"/>
    <Rect x="15.5" y="13" width="3" height="3" rx="0.5" stroke="#FDCF34" strokeWidth={1} fill="none"/>
  </Svg>
);

// ─── Helper upload photo ───────────────────────────────────────────────────────

async function uploadSpacePhoto(localUri: string, vipProfilId: string, spaceId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `restaurant-spaces/${vipProfilId}/${spaceId}.${ext}`;

  const fileRes = await fetch(localUri);
  const arrayBuffer = await fileRes.arrayBuffer();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        SUPABASE_ANON,
      'Content-Type':  `image/${ext}`,
      'x-bucket':      'gallery',
      'x-path':        path,
    },
    body: arrayBuffer,
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? 'Upload échoué');
  return json.url as string;
}

// ─── Formulaire d'un espace ───────────────────────────────────────────────────

interface SpaceForm {
  nom: string;
  description: string;
  capacite: string;
  photo_url: string;
  actif: boolean;
}

const EMPTY_FORM: SpaceForm = { nom: '', description: '', capacite: '', photo_url: '', actif: true };

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function GerantEspacesScreen({ onBack }: Props) {
  const profil = useGerantStore(s => s.profil);
  const vipProfilId = profil?.id ?? '';

  const [spaces, setSpaces]       = useState<RestaurantSpace[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<RestaurantSpace | null>(null);
  const [form, setForm]           = useState<SpaceForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!vipProfilId) return;
    setLoading(true);
    try {
      const data = await getAllRestaurantSpaces(vipProfilId);
      setSpaces(data);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [vipProfilId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (sp: RestaurantSpace) => {
    setEditing(sp);
    setForm({
      nom:         sp.nom,
      description: sp.description ?? '',
      capacite:    sp.capacite != null ? String(sp.capacite) : '',
      photo_url:   sp.photo_url ?? '',
      actif:       sp.actif,
    });
    setModalOpen(true);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour ajouter une photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, photo_url: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { Alert.alert('Nom requis'); return; }
    setSaving(true);
    try {
      let photoUrl = form.photo_url;

      // Upload si c'est une URI locale (commence par file:// ou content://)
      if (photoUrl && (photoUrl.startsWith('file://') || photoUrl.startsWith('content://'))) {
        setUploading(true);
        const tmpId = editing?.id ?? `tmp-${Date.now()}`;
        photoUrl = await uploadSpacePhoto(photoUrl, vipProfilId, tmpId);
        setUploading(false);
      }

      const cap = parseInt(form.capacite, 10);
      await upsertRestaurantSpace({
        ...(editing ? { id: editing.id } : {}),
        vip_profil_id: vipProfilId,
        nom:           form.nom.trim(),
        description:   form.description.trim() || undefined,
        capacite:      Number.isNaN(cap) ? undefined : cap,
        photo_url:     photoUrl || undefined,
        actif:         form.actif,
        position:      editing?.position ?? spaces.length,
      });
      setModalOpen(false);
      load();
    } catch (err) {
      Alert.alert('Erreur', getErrorMessage(err));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = (sp: RestaurantSpace) => {
    Alert.alert(
      'Supprimer cet espace ?',
      `"${sp.nom}" ne sera plus visible pour les clients.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRestaurantSpace(sp.id);
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
          <Text style={s.headerTitle}>Mes espaces</Text>
          <Text style={s.headerSub}>Étages, terrasses, salles privées…</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <IcoPlus />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={r.couleur.or} size="large" />
        </View>
      ) : spaces.length === 0 ? (
        <View style={s.center}>
          <IcoHouse />
          <Text style={s.emptyTitle}>Aucun espace configuré</Text>
          <Text style={s.emptySub}>Ajoutez vos espaces (Étage 1, Terrasse, Salon VIP…) pour que vos clients puissent choisir lors de leur réservation.</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={s.emptyAddTxt}>Ajouter un espace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {spaces.map((sp, i) => (
            <View key={sp.id} style={[s.card, !sp.actif && s.cardInactif]}>
              {sp.photo_url ? (
                <Image source={{ uri: sp.photo_url }} style={s.cardPhoto} resizeMode="cover" />
              ) : (
                <View style={s.cardPhotoPlaceholder}>
                  <IcoCamera />
                </View>
              )}
              <View style={s.cardBody}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardNom}>{sp.nom}</Text>
                  {!sp.actif && <Text style={s.inactifBadge}>Inactif</Text>}
                </View>
                {sp.description ? <Text style={s.cardDesc} numberOfLines={2}>{sp.description}</Text> : null}
                {sp.capacite ? <Text style={s.cardCap}>≤ {sp.capacite} personnes</Text> : null}
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(sp)} activeOpacity={0.8}>
                    <Text style={s.editBtnTxt}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(sp)} activeOpacity={0.8}>
                    <Text style={s.deleteBtnTxt}>Supprimer</Text>
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
                <Text style={s.sheetTitle}>{editing ? 'Modifier l\'espace' : 'Nouvel espace'}</Text>

                {/* Photo */}
                <TouchableOpacity style={s.photoBox} onPress={pickPhoto} activeOpacity={0.8}>
                  {form.photo_url ? (
                    <Image source={{ uri: form.photo_url }} style={s.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={s.photoPlaceholder}>
                      <IcoCamera />
                      <Text style={s.photoPlaceholderTxt}>Ajouter une photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={s.fieldLabel}>Nom de l'espace *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex : Étage 1, Terrasse, Salon VIP"
                  placeholderTextColor={r.couleur.gris}
                  value={form.nom}
                  onChangeText={v => setForm(f => ({ ...f, nom: v }))}
                  maxLength={80}
                />

                <Text style={s.fieldLabel}>Description (optionnel)</Text>
                <TextInput
                  style={[s.input, s.inputMulti]}
                  placeholder="Ambiance, vue, capacité, particularités…"
                  placeholderTextColor={r.couleur.gris}
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  multiline
                  maxLength={300}
                />

                <Text style={s.fieldLabel}>Capacité max (optionnel)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex : 20"
                  placeholderTextColor={r.couleur.gris}
                  value={form.capacite}
                  onChangeText={v => setForm(f => ({ ...f, capacite: v.replace(/\D/g, '') }))}
                  keyboardType="numeric"
                  maxLength={4}
                />

                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Espace actif</Text>
                  <Switch
                    value={form.actif}
                    onValueChange={v => setForm(f => ({ ...f, actif: v }))}
                    thumbColor={form.actif ? r.couleur.orLassi : r.couleur.gris}
                    trackColor={{ true: `${r.couleur.orLassi}40`, false: r.couleur.filet }}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving || uploading}
                  activeOpacity={0.85}
                >
                  {saving || uploading
                    ? <ActivityIndicator color={r.couleur.encre} />
                    : <Text style={s.saveBtnTxt}>{uploading ? 'Upload photo…' : editing ? 'Enregistrer' : 'Créer l\'espace'}</Text>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 16 },
  emptySub:   { color: r.couleur.gris,   fontFamily: r.police.util,  fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyAddBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: r.couleur.orLassi,
  },
  emptyAddTxt: { color: r.couleur.encre, fontFamily: r.police.titre, fontSize: 14 },

  content: { padding: 16 },

  card: {
    flexDirection: 'row',
    backgroundColor: r.couleur.velours,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardInactif: { opacity: 0.55 },
  cardPhoto: { width: 90, height: 90 },
  cardPhotoPlaceholder: {
    width: 90, height: 90,
    backgroundColor: `${r.couleur.or}0A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody:     { flex: 1, padding: 12, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNom:      { color: r.couleur.ivoire, fontFamily: r.police.titre, fontSize: 14, flex: 1 },
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
  cardDesc: { color: r.couleur.gris,    fontFamily: r.police.util, fontSize: 11, lineHeight: 15 },
  cardCap:  { color: r.couleur.orClair, fontFamily: r.police.util, fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: r.couleur.or,
    backgroundColor: `${r.couleur.or}12`,
  },
  editBtnTxt:   { color: r.couleur.or,   fontFamily: r.police.util, fontSize: 11 },
  deleteBtn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#E55C5C', backgroundColor: 'rgba(229,92,92,0.08)' },
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

  photoBox: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: `${r.couleur.or}0A`,
  },
  photoPreview:  { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderTxt: { color: r.couleur.gris, fontFamily: r.police.util, fontSize: 12 },

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
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },

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
