import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radius } from '../../theme';
import BlocStoryCard, { STORY_W, STORY_H_BASE } from './BlocStoryCard';
import type { BlocALaUne } from '../../types/aLaUne';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PREVIEW_MAX_H = Math.min(STORY_H_BASE + 60, SCREEN_H * 0.48);
const CARD_MARGIN_LEFT = Math.max(16, (SCREEN_W - STORY_W) / 2);

interface Props {
  visible: boolean;
  onClose: () => void;
  bloc: BlocALaUne;
  shopName: string;
  shopLogoUrl?: string | null;
  shopPhone?: string | null;
  isShopOpen?: boolean;
  countdown: string;
}

export default function StoryShareModal({
  visible,
  onClose,
  bloc,
  shopName,
  shopLogoUrl,
  shopPhone,
  isShopOpen,
  countdown,
}: Props) {
  const cardRef = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);
  const [productImageUri, setProductImageUri] = useState<string | null>(null);

  // ── Sélection galerie ──────────────────────────────────────────────────────
  // IMPORTANT : ne PAS fermer le modal avant le picker.
  // Sur iOS, présenter un native VC pendant qu'un Modal se ferme
  // provoque un échec silencieux — le picker doit s'ouvrir par-dessus le modal.
  const handlePickGallery = async () => {
    let result: ImagePicker.ImagePickerResult | null = null;
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les Réglages.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
        allowsMultipleSelection: false,
      });
    } catch (e) {
      Alert.alert('Erreur', String(e));
      return;
    }
    if (result && !result.canceled && result.assets?.[0]) {
      setProductImageUri(result.assets[0].uri);
    }
  };

  // ── Prise de vue appareil photo ────────────────────────────────────────────
  const handleCamera = async () => {
    let result: ImagePicker.ImagePickerResult | null = null;
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les Réglages.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });
    } catch (e) {
      Alert.alert('Erreur', String(e));
      return;
    }
    if (result && !result.canceled && result.assets?.[0]) {
      setProductImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => setProductImageUri(null);

  // ── Capture + partage ──────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      setCapturing(true);
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        snapshotContentContainer: false,
      });
      setCapturing(false);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Non disponible", "Le partage d'image n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Partager votre bloc À la une',
        UTI: 'public.png',
      });
    } catch {
      setCapturing(false);
      Alert.alert('Erreur', "Impossible de générer l'image. Réessayez.");
    }
  };

  const handleClose = () => {
    setProductImageUri(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Poignée */}
          <View style={styles.handle} />

          {/* En-tête */}
          <View style={styles.header}>
            <Text style={styles.title}>Aperçu avant partage</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Photo produit ── */}
          <View style={styles.photoSection}>
            {productImageUri ? (
              /* Image sélectionnée — afficher miniature + actions */
              <View style={styles.thumbRow}>
                <Image source={{ uri: productImageUri }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.thumbMeta}>
                  <Text style={styles.thumbLabel}>✓ Photo produit ajoutée</Text>
                  <View style={styles.thumbActions}>
                    <TouchableOpacity onPress={handlePickGallery} style={styles.thumbActionBtn}>
                      <Text style={styles.thumbActionTxt}>🖼 Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCamera} style={styles.thumbActionBtn}>
                      <Text style={styles.thumbActionTxt}>📷 Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.thumbActionBtnDanger}>
                      <Text style={styles.thumbActionDangerTxt}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              /* Pas d'image — deux boutons côte à côte */
              <View style={styles.photoPickRow}>
                <TouchableOpacity
                  style={styles.photoPickBtn}
                  onPress={handleCamera}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoPickIcon}>📷</Text>
                  <Text style={styles.photoPickTxt}>Prendre une photo</Text>
                </TouchableOpacity>

                <View style={styles.photoPickSep} />

                <TouchableOpacity
                  style={styles.photoPickBtn}
                  onPress={handlePickGallery}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoPickIcon}>🖼</Text>
                  <Text style={styles.photoPickTxt}>Depuis la galerie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Indice */}
          <Text style={styles.hint}>
            Instagram, Facebook, TikTok… l'image s'ouvrira directement en mode story.
          </Text>

          {/* Aperçu scrollable */}
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={[styles.previewContent, { paddingLeft: CARD_MARGIN_LEFT }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.cardShadow}>
              <BlocStoryCard
                ref={cardRef}
                bloc={bloc}
                shopName={shopName}
                shopLogoUrl={shopLogoUrl}
                shopPhone={shopPhone}
                isShopOpen={isShopOpen}
                countdown={countdown}
                productImageUri={productImageUri}
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.shareBtn, capturing && styles.btnDisabled]}
              onPress={handleShare}
              disabled={capturing}
              activeOpacity={0.8}
            >
              {capturing ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.shareTxt}>📤 Partager l'image</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '95%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  closeBtn: { padding: 4 },
  closeTxt: { color: colors.muted, fontSize: 18 },

  // ── Zone photo produit ────────────────────────────────────────────────────
  photoSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },

  // Deux boutons côte à côte (état vide)
  photoPickRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  photoPickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  photoPickSep: {
    width: 1,
    backgroundColor: colors.border,
  },
  photoPickIcon: { fontSize: 20 },
  photoPickTxt: {
    color: colors.muted,
    fontFamily: fonts.label,
    fontSize: 11.5,
  },

  // Ligne miniature (image sélectionnée)
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  thumb: {
    width: 76,
    height: 43,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  thumbMeta: { flex: 1, gap: 6 },
  thumbLabel: {
    color: colors.success,
    fontFamily: fonts.label,
    fontSize: 12,
  },
  thumbActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  thumbActionBtn: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  thumbActionTxt: { color: colors.accent, fontFamily: fonts.ui, fontSize: 11 },
  thumbActionBtnDanger: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  thumbActionDangerTxt: { color: colors.danger, fontFamily: fonts.ui, fontSize: 11 },

  // ── Indice ────────────────────────────────────────────────────────────────
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    lineHeight: 16,
  },

  // ── Aperçu carte ─────────────────────────────────────────────────────────
  previewScroll: { maxHeight: PREVIEW_MAX_H },
  previewContent: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingRight: 16,
  },
  cardShadow: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  shareBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  shareTxt: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: {
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelTxt: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 13.5,
  },
});
