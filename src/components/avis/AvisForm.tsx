import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import StarRating from './StarRating';
import { Avis } from '../../types/avis';
import * as avisService from '../../services/avis';
import * as storageService from '../../services/storage';
import useAuthStore from '../../store/authStore';
import { IcoClose } from '../icons';

// ─── Icônes ───────────────────────────────────────────────────────────────────

const IcoPhoto = () => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path
      d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"
      stroke={colors.muted}
    />
    <Path d="M12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke={colors.muted} />
  </Svg>
);

const IcoTrash = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.danger} />
  </Svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extrait le chemin relatif depuis une URL publique Supabase Storage.
// Exemple : https://xxx.supabase.co/storage/v1/object/public/avis/userId/file.jpg
//        → userId/file.jpg
function avisStoragePath(publicUrl: string): string | null {
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/avis\/(.+)/);
  return match ? match[1] : null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  shopId: string;
  shopName: string;
  orderId?: string;
  existingAvis?: Avis;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AvisForm({
  visible,
  shopId,
  shopName,
  orderId,
  existingAvis,
  onClose,
  onSaved,
}: Props) {
  const user = useAuthStore(s => s.user);

  const [note, setNote] = useState(existingAvis?.note ?? 0);
  const [commentaire, setCommentaire] = useState(existingAvis?.commentaire ?? '');
  // URL distante : photo déjà enregistrée côté serveur (mode édition)
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingAvis?.photoUrl ?? null);
  // URI locale : photo sélectionnée dans la galerie, pas encore uploadée
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(existingAvis);
  // URI affichée dans le preview : locale en priorité, sinon distante
  const previewUri = photoLocalUri ?? photoUrl;
  const hasPhoto = previewUri !== null;

  // ── Sélection photo (preview local uniquement — pas d'upload ici) ──────────
  const handlePickPhoto = async () => {
    const uri = await storageService.pickImageFromGallery();
    if (!uri) return;
    setPhotoLocalUri(uri);
  };

  const handleRemovePhoto = () => {
    setPhotoLocalUri(null);
    setPhotoUrl(null);
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (note === 0) {
      Alert.alert('Note manquante', 'Choisis une note entre 1 et 5 étoiles.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Session expirée', 'Reconnecte-toi pour publier ton avis.');
      return;
    }
    const authorId = user.id; // narrowé : user non-null après le guard ci-dessus

    setSaving(true);

    // ① Upload de la photo UNIQUEMENT à la soumission (jamais avant)
    let finalPhotoUrl = photoUrl; // null ou URL existante (mode édition)
    let uploadedPath: string | null = null;

    if (photoLocalUri) {
      const path = `${authorId}/${Date.now()}.jpg`;
      try {
        finalPhotoUrl = await storageService.uploadImage('avis', photoLocalUri, path);
        uploadedPath = path;
      } catch {
        Alert.alert('Erreur photo', "Impossible d'envoyer la photo. Réessaie.");
        setSaving(false);
        return;
      }
    }

    // ② Appel RPC — si ça échoue, la photo uploadée est supprimée immédiatement
    try {
      if (isEdit && existingAvis) {
        await avisService.updateAvis(existingAvis.id, {
          note,
          commentaire: commentaire.trim() || null,
          photoUrl: finalPhotoUrl,
        });

        // Supprimer l'ancienne photo si elle a changé (remplacée OU supprimée)
        if (existingAvis.photoUrl && existingAvis.photoUrl !== finalPhotoUrl) {
          const oldPath = avisStoragePath(existingAvis.photoUrl);
          if (oldPath) storageService.deleteImage('avis', oldPath).catch(() => {});
        }
      } else {
        await avisService.createAvis({
          orderId,
          shopId,
          authorId,
          authorName: user.name ?? 'Anonyme',
          note,
          commentaire: commentaire.trim() || undefined,
          photoUrl: finalPhotoUrl ?? undefined,
        });
      }

      onSaved();
      onClose();
    } catch (e: unknown) {
      // ③ Échec RPC → supprimer la photo qu'on venait d'uploader (évite la fuite)
      if (uploadedPath) {
        storageService.deleteImage('avis', uploadedPath).catch(() => {});
      }

      const raw = e instanceof Error ? e.message : '';
      const msg = raw.includes('row-level security')
        ? 'Tu dois avoir effectué une commande chez ce prestataire pour laisser un avis.'
        : raw || 'Impossible de publier ton avis. Réessaie.';
      Alert.alert('Avis non autorisé', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existingAvis) return;
    Alert.alert('Supprimer mon avis', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await avisService.deleteAvis(existingAvis.id);
            onSaved();
            onClose();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.sheet}>
          {/* ── Titre ── */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {isEdit ? 'Modifier mon avis' : `Avis pour ${shopName}`}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <IcoClose color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* ── Étoiles ── */}
            <Text style={styles.label}>Ta note *</Text>
            <View style={styles.starsRow}>
              <StarRating value={note} onChange={setNote} size={38} gap={8} />
              {note > 0 && (
                <Text style={styles.noteLabel}>
                  {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'][note]}
                </Text>
              )}
            </View>

            {/* ── Commentaire ── */}
            <Text style={styles.label}>
              Commentaire <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="Décris ton expérience…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{commentaire.length}/500</Text>

            {/* ── Photo ── */}
            <Text style={styles.label}>
              Photo <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            {hasPhoto ? (
              <View style={styles.photoPreviewRow}>
                <Image source={{ uri: previewUri! }} style={styles.photoThumb} />
                <Text style={styles.photoCaption} numberOfLines={1}>
                  {photoLocalUri ? 'Photo sélectionnée' : (photoUrl!.split('/').pop() ?? 'Photo')}
                </Text>
                <TouchableOpacity onPress={handleRemovePhoto} activeOpacity={0.7}>
                  <IcoTrash />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                <IcoPhoto />
                <Text style={styles.photoBtnTxt}>Ajouter une photo</Text>
              </TouchableOpacity>
            )}

            {/* ── Actions ── */}
            <TouchableOpacity
              style={[styles.submitBtn, (saving || note === 0) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving || note === 0}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={styles.submitTxt}>
                  {isEdit ? 'Mettre à jour' : 'Publier mon avis'}
                </Text>
              )}
            </TouchableOpacity>

            {isEdit && (
              <TouchableOpacity
                style={styles.deleteLink}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteLinkTxt}>Supprimer mon avis</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.titleXL,
    fontSize: 17,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },

  label: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
    marginBottom: 10,
    marginTop: 6,
  },
  optional: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  noteLabel: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 13,
  },

  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 13,
    minHeight: 90,
  },
  charCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10.5,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 10,
  },

  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 13,
    marginBottom: 18,
  },
  photoBtnTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 18,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  photoCaption: {
    flex: 1,
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },

  deleteLink: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
  },
  deleteLinkTxt: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
