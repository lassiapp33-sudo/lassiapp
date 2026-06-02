import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoCamera = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      stroke={colors.accent} />
    <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={colors.accent} />
  </Svg>
);

const IcoGallery = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"
      stroke={colors.accent} />
    <Path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" stroke={colors.accent} />
    <Path d="m21 15-5-5L5 21" stroke={colors.accent} />
  </Svg>
);

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visible:       boolean;
  onClose:       () => void;
  onImagePicked: (uri: string) => void;
}

// ─── Compression (max 1200 px, qualité 75 %) ─────────────────────────────────

async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri; // si la compression échoue, on envoie l'original
  }
}

// ─── Composant ───────────────────────────────────────────────────────────────

const BOTTOM_PAD = Platform.OS === 'ios' ? 34 : 20;

export default function AttachSheet({ visible, onClose, onImagePicked }: Props) {

  const pick = async (source: 'camera' | 'gallery') => {
    // IMPORTANT : on ne ferme PAS le modal avant le picker.
    // Sur iOS, présenter un native VC pendant qu'un Modal se ferme
    // provoque un échec silencieux du picker.
    // On ferme dans le bloc finally, après que le picker ait rendu la main.

    let result: ImagePicker.ImagePickerResult | null = null;

    try {
      if (source === 'camera') {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra dans les réglages.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes:    ['images'],
          allowsEditing: true,
          quality:       0.9,
        });
      } else {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les réglages.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:             ['images'],
          allowsEditing:          false,
          quality:                0.9,
          allowsMultipleSelection: false,
        });
      }
    } finally {
      // Le picker a rendu la main (image choisie ou annulée) → on ferme le sheet
      onClose();
    }

    if (!result || result.canceled || !result.assets?.[0]) return;

    // Compression avant envoi
    const compressed = await compressImage(result.assets[0].uri);
    onImagePicked(compressed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { paddingBottom: BOTTOM_PAD }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>Joindre un fichier</Text>

        <View style={styles.options}>
          <TouchableOpacity style={styles.option} onPress={() => pick('camera')} activeOpacity={0.75}>
            <View style={styles.iconWrap}>
              <IcoCamera />
            </View>
            <Text style={styles.optionLabel}>Appareil photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => pick('gallery')} activeOpacity={0.75}>
            <View style={styles.iconWrap}>
              <IcoGallery />
            </View>
            <Text style={styles.optionLabel}>Galerie</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.cancelLabel}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    20,
    paddingTop:           16,
    borderTopWidth:       1,
    borderTopColor:       colors.border,
  },

  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginBottom:    16,
  },

  title: {
    color:        colors.white,
    fontFamily:   fonts.title,
    fontSize:     15,
    marginBottom: 20,
    textAlign:    'center',
  },

  options: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            32,
    marginBottom:   24,
  },

  option: {
    alignItems: 'center',
    gap:        8,
  },

  iconWrap: {
    width:           64,
    height:          64,
    borderRadius:    18,
    backgroundColor: `${colors.accent}18`,
    borderWidth:     1,
    borderColor:     `${colors.accent}44`,
    alignItems:      'center',
    justifyContent:  'center',
  },

  optionLabel: {
    color:      colors.white,
    fontFamily: fonts.body,
    fontSize:   12,
  },

  cancelBtn: {
    height:          48,
    borderRadius:    radius.md,
    backgroundColor: colors.bg,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },

  cancelLabel: {
    color:      '#5a5c80',
    fontFamily: fonts.body,
    fontSize:   14,
  },
});
