import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Image, ActionSheetIOS,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, TOP_INSET } from '../../theme';
import { IcoBack } from '../../components/icons';
import { formatPrice } from '../../utils/format';
import { BeautyService, BeautyCategorie } from '../../types/beauty';
import * as beautyService from '../../services/beauty';
import * as storageService from '../../services/storage';
import useAuthStore from '../../store/authStore';
import logger from '../../utils/logger';

// ─── Icônes ────────────────────────────────────────────────────────────────────

const IcoPlus = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" stroke={colors.bg} />
  </Svg>
);

const IcoTrash = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.danger} />
  </Svg>
);

const IcoCamera = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={colors.white} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={colors.white} />
  </Svg>
);

// ─── Durées disponibles ────────────────────────────────────────────────────────

const DUREES = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1h' },
  { value: 90,  label: '1h30' },
  { value: 120, label: '2h' },
];

// ─── Modal ajout/édition ───────────────────────────────────────────────────────

interface EditModalProps {
  service: Partial<BeautyService> | null;
  prestataireId: string;
  onClose: () => void;
  onSaved: (s: BeautyService) => void;
}

function EditModal({ service, prestataireId, onClose, onSaved }: EditModalProps) {
  const [nom, setNom]           = useState(service?.nom ?? '');
  const [desc, setDesc]         = useState(service?.description ?? '');
  const [prix, setPrix]         = useState(service?.prix ? String(service.prix) : '');
  const [duree, setDuree]       = useState(service?.duree_minutes ?? 60);
  const cat: BeautyCategorie    = service?.categorie ?? 'general';
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);

  const doPickImage = async (source: 'gallery' | 'camera') => {
    try {
      const uri = source === 'gallery'
        ? await storageService.pickImageFromGallery()
        : await storageService.pickImageFromCamera();
      if (!uri) return;
      setUploading(true);
      const path = `${prestataireId}/${service?.id ?? `new_${Date.now()}`}.jpg`;
      const url = await storageService.uploadImage('beauty', uri, path);
      setImageUrl(url);
    } catch (e) {
      logger.error('[BeautyServiceCatalog] upload image:', e);
      Alert.alert('Erreur', "Impossible d'uploader la photo. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  const deferPick = (source: 'gallery' | 'camera') =>
    setTimeout(() => doPickImage(source), 350);

  const openPhotoPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Galerie', 'Caméra', ...(imageUrl ? ['Supprimer la photo'] : [])], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) deferPick('gallery');
          if (idx === 2) deferPick('camera');
          if (idx === 3 && imageUrl) setImageUrl(null);
        },
      );
    } else {
      const buttons: { text: string; onPress: () => void }[] = [
        { text: 'Galerie',  onPress: () => deferPick('gallery') },
        { text: 'Caméra',   onPress: () => deferPick('camera') },
      ];
      if (imageUrl) buttons.push({ text: 'Supprimer la photo', onPress: () => setImageUrl(null) });
      Alert.alert('Photo du service', '', buttons);
    }
  };

  const handleSave = async () => {
    const prixNum = parseInt(prix, 10);
    if (!nom.trim()) return Alert.alert('', 'Le nom est requis');
    if (!prixNum || prixNum < 10) return Alert.alert('', 'Prix minimum 10 FCFA');
    setSaving(true);
    try {
      const saved = await beautyService.saveBeautyService({
        id:            service?.id,
        prestataire_id: prestataireId,
        nom:           nom.trim(),
        description:   desc.trim() || null,
        prix:          prixNum,
        duree_minutes: duree,
        categorie:     cat,
        image_url:     imageUrl,
        actif:         true,
      });
      onSaved(saved);
    } catch (e) {
      logger.error('[BeautyServiceCatalog] save:', e);
      const err = e as { message?: string; code?: string; details?: string; hint?: string };
      const detail = [err?.code, err?.message, err?.details, err?.hint].filter(Boolean).join('\n');
      Alert.alert('Erreur', detail || 'Impossible de sauvegarder le service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={modal.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={modal.header}>
          <Text style={modal.title}>{service?.id ? 'Modifier' : 'Ajouter'} un service</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
            <Text style={modal.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modal.scroll} contentContainerStyle={modal.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Photo ── */}
          <Text style={modal.label}>Photo (optionnel)</Text>
          <TouchableOpacity style={modal.photoBtn} onPress={openPhotoPicker} activeOpacity={0.8} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : imageUrl ? (
              <Image source={{ uri: imageUrl }} style={modal.photoPreview} />
            ) : (
              <View style={modal.photoPlaceholder}>
                <IcoCamera />
                <Text style={modal.photoPlaceholderTxt}>Galerie / Caméra</Text>
              </View>
            )}
            {imageUrl && !uploading && (
              <View style={modal.photoEditBadge}>
                <Text style={modal.photoEditBadgeTxt}>Changer</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={modal.label}>Nom du service *</Text>
          <TextInput
            style={modal.input}
            value={nom}
            onChangeText={setNom}
            placeholder="ex: Coupe simple, Tresses box braids..."
            placeholderTextColor={colors.muted}
            maxLength={60}
          />

          <Text style={modal.label}>Description</Text>
          <TextInput
            style={[modal.input, { height: 80 }]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Détails optionnels..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={200}
          />

          <Text style={modal.label}>Prix (FCFA) *</Text>
          <TextInput
            style={modal.input}
            value={prix}
            onChangeText={setPrix}
            placeholder="ex: 1500"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            maxLength={7}
          />

          <Text style={modal.label}>Durée</Text>
          <View style={modal.chipRow}>
            {DUREES.map(d => (
              <TouchableOpacity
                key={d.value}
                style={[modal.chip, duree === d.value && modal.chipOn]}
                onPress={() => setDuree(d.value)}
                activeOpacity={0.8}
              >
                <Text style={[modal.chipTxt, duree === d.value && modal.chipTxtOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>

        <View style={modal.footer}>
          <TouchableOpacity
            style={[modal.saveBtn, (saving || uploading) && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving || uploading}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={modal.saveTxt}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Écran principal ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function BeautyServiceCatalogScreen({ onBack }: Props) {
  const prestataireId = useAuthStore(s => s.user?.id ?? '');
  const [services, setServices]       = useState<BeautyService[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editTarget, setEditTarget]   = useState<Partial<BeautyService> | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await beautyService.getBeautyServicesByMerchant(prestataireId);
      setServices(data);
    } catch (e) {
      logger.error('[BeautyServiceCatalog] load:', e);
    } finally {
      setLoading(false);
    }
  }, [prestataireId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (s: BeautyService) => {
    Alert.alert('Supprimer', `Supprimer "${s.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await beautyService.deleteBeautyService(s.id);
            setServices(prev => prev.filter(x => x.id !== s.id));
          } catch (e) {
            logger.error('[BeautyServiceCatalog] delete:', e);
          }
        },
      },
    ]);
  };

  const handleSaved = (saved: BeautyService) => {
    setServices(prev => {
      const idx = prev.findIndex(x => x.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setEditTarget(null);
  };

  const activeServices   = services.filter(s => s.actif);
  const inactiveServices = services.filter(s => !s.actif);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catalogue réservations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setEditTarget('new')} activeOpacity={0.85}>
          <IcoPlus />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeServices.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun service configuré</Text>
              <Text style={styles.emptySub}>Ajoute tes prestations pour que les clients puissent réserver un créneau.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setEditTarget('new')} activeOpacity={0.85}>
                <Text style={styles.emptyBtnTxt}>+ Ajouter un service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.secLabel}>Services actifs ({activeServices.length})</Text>
              {activeServices.map(s => (
                <ServiceCard key={s.id} service={s} onEdit={() => setEditTarget(s)} onDelete={() => handleDelete(s)} />
              ))}
            </>
          )}

          {inactiveServices.length > 0 && (
            <>
              <Text style={[styles.secLabel, { marginTop: 20 }]}>Désactivés ({inactiveServices.length})</Text>
              {inactiveServices.map(s => (
                <ServiceCard key={s.id} service={s} onEdit={() => setEditTarget(s)} onDelete={() => handleDelete(s)} inactive />
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {editTarget !== null && (
        <EditModal
          service={editTarget === 'new' ? {} : editTarget}
          prestataireId={prestataireId}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </View>
  );
}

// ─── Carte service ─────────────────────────────────────────────────────────────

function ServiceCard({ service, onEdit, onDelete, inactive = false }: {
  service: BeautyService;
  onEdit: () => void;
  onDelete: () => void;
  inactive?: boolean;
}) {
  const dureeLabel = DUREES.find(d => d.value === service.duree_minutes)?.label ?? `${service.duree_minutes} min`;

  if (service.image_url) {
    return (
      <TouchableOpacity
        style={[styles.visualCard, inactive && styles.cardInactive]}
        onPress={onEdit}
        activeOpacity={0.88}
      >
        <Image source={{ uri: service.image_url }} style={styles.visualImg} />
        <View style={styles.visualDeleteBtn}>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <IcoTrash />
          </TouchableOpacity>
        </View>
        <View style={styles.visualInfo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.visualNom} numberOfLines={1}>{service.nom}</Text>
            <Text style={styles.visualDuree}>{dureeLabel} · réservable</Text>
          </View>
          <Text style={styles.visualPrix}>{formatPrice(service.prix)}</Text>
        </View>
        <TouchableOpacity style={styles.visualReserveBtn} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.visualReserveTxt}>Réserver</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, inactive && styles.cardInactive]} onPress={onEdit} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardNom, inactive && { color: colors.muted }]}>{service.nom}</Text>
          {service.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{service.description}</Text>
          ) : null}
          <Text style={styles.cardDuree}>{dureeLabel}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardPrix}>{formatPrice(service.prix)}</Text>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <IcoTrash />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { padding: 18 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  addBtn:      { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  secLabel: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },

  // ── carte texte (sans image) ──
  card:         { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardInactive: { opacity: 0.5 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardNom:      { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  cardDesc:     { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 3, lineHeight: 16 },
  cardDuree:    { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  cardRight:    { alignItems: 'flex-end', gap: 10 },
  cardPrix:     { color: colors.accent, fontFamily: fonts.title, fontSize: 14 },

  // ── carte visuelle (avec image) ──
  visualCard:       { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  visualImg:        { width: '100%', height: 160, backgroundColor: colors.border },
  visualDeleteBtn:  { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 8 },
  visualInfo:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, gap: 8 },
  visualNom:        { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  visualDuree:      { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  visualPrix:       { color: colors.accent, fontFamily: fonts.title, fontSize: 16 },
  visualReserveBtn: { margin: 12, marginTop: 10, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  visualReserveTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },

  empty:       { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle:  { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  emptySub:    { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  emptyBtn:    { marginTop: 10, height: 46, paddingHorizontal: 24, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  emptyBtnTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
});

const modal = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 50 },
  title:  { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  closeBtn: { padding: 4 },
  closeTxt: { color: colors.muted, fontSize: 18 },

  scroll:  { flex: 1 },
  content: { padding: 20 },

  label: { color: colors.muted, fontFamily: fonts.ui, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, color: colors.white, fontFamily: fonts.body,
    fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },

  // ── photo picker ──
  photoBtn: {
    width: '100%', height: 140, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  photoPreview:        { width: '100%', height: '100%' },
  photoPlaceholder:    { alignItems: 'center', gap: 8 },
  photoPlaceholderTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  photoEditBadge:      { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  photoEditBadgeTxt:   { color: colors.white, fontFamily: fonts.ui, fontSize: 11 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn:  { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 13 },
  chipTxtOn: { color: colors.bg },

  footer:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { height: 54, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 16 },
});
