import React, { useRef, useState } from 'react';
import {
  View,
  Text,
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
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import BlocStoryCard, { STORY_W, STORY_H_BASE } from './BlocStoryCard';
import type { BlocALaUne } from '../../types/aLaUne';

const IcoShareUp = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke={colors.bg} />
  </Svg>
);

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PREVIEW_MAX_H = Math.min(STORY_H_BASE + 60, SCREEN_H * 0.55);
// Padding horizontal symétrique : 0 si la carte remplit déjà l'écran, sinon centré
const CARD_PADDING_H = Math.max(0, (SCREEN_W - STORY_W) / 2);

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
        Alert.alert('Non disponible', "Le partage d'image n'est pas disponible sur cet appareil.");
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Aperçu avant partage</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Instagram, Facebook, TikTok… l'image s'ouvrira directement en mode story.
          </Text>

          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
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
                productImageUri={bloc.image_url ?? null}
              />
            </View>
          </ScrollView>

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
                <View style={styles.shareBtnContent}>
                <IcoShareUp />
                <Text style={styles.shareTxt}>Partager l'image</Text>
              </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    maxHeight: '92%',
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

  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    lineHeight: 16,
  },

  previewScroll: { maxHeight: PREVIEW_MAX_H },
  previewContent: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: CARD_PADDING_H,
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
  shareBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
