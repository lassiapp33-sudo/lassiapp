import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { parseMenuText, ParsedMenuItem } from '../../utils/menuParser';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.white} />
  </Svg>
);

const IcoCamera = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={colors.accent} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={colors.accent} />
  </Svg>
);

const IcoGallery = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.accent} />
    <Path d="m3 15 5-5 4 4 3-3 6 6" stroke={colors.accent} />
    <Path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" stroke={colors.accent} fill={`${colors.accent}40`} />
  </Svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDone: (items: ParsedMenuItem[]) => void;
  onClose: () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ScanMenuCamera({ visible, onDone, onClose }: Props) {
  const [scanning, setScanning] = useState(false);

  const processImage = async (uri: string) => {
    setScanning(true);
    try {
      const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
      const items = parseMenuText(result.text);
      if (items.length === 0) {
        Alert.alert(
          'Aucun texte détecté',
          'Essaie en améliorant l\'éclairage et en centrant bien le menu dans le cadre.',
        );
        return;
      }
      onDone(items);
    } catch {
      Alert.alert('Erreur de lecture', 'Impossible d\'analyser l\'image. Réessaie.');
    } finally {
      setScanning(false);
    }
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Active l\'accès caméra dans les réglages de ton téléphone.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Scanner le menu</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <IcoClose />
          </TouchableOpacity>
        </View>

        {scanning ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingTxt}>Lecture du texte en cours…</Text>
            <Text style={styles.loadingHint}>Ça prend quelques secondes</Text>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Prends en photo ton menu ou liste de prix.{'\n'}
              L'app détecte automatiquement les produits et leurs tarifs.
            </Text>

            <View style={styles.btnGroup}>
              <TouchableOpacity style={styles.optionBtn} onPress={handleCamera} activeOpacity={0.85}>
                <IcoCamera />
                <Text style={styles.optionLabel}>Prendre une photo</Text>
                <Text style={styles.optionSub}>Idéal pour photographier directement ton menu</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionBtn} onPress={handleGallery} activeOpacity={0.85}>
                <IcoGallery />
                <Text style={styles.optionLabel}>Choisir dans la galerie</Text>
                <Text style={styles.optionSub}>Utilise une photo déjà prise ou un fichier</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.hintBox}>
              <Text style={styles.hintTxt}>
                Analyse 100% locale — aucune image envoyée sur internet.{'\n'}
                Fonctionne même sans connexion.
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const SAFE_TOP = Platform.OS === 'ios' ? 56 : 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SAFE_TOP,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  loadingTxt: { color: colors.white, fontFamily: fonts.title, fontSize: 16 },
  loadingHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 28 },
  subtitle: {
    color: colors.muted, fontFamily: fonts.body, fontSize: 14,
    lineHeight: 22, textAlign: 'center',
  },

  btnGroup: { gap: 14 },
  optionBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', gap: 10,
  },
  optionLabel: { color: colors.white, fontFamily: fonts.title, fontSize: 15 },
  optionSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },

  hintBox: {
    backgroundColor: `${colors.accent}12`,
    borderWidth: 1, borderColor: `${colors.accent}30`,
    borderRadius: radius.sm,
    padding: 14,
  },
  hintTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
