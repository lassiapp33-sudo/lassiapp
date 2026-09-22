import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

const IcoClose = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" stroke="#fff" />
  </Svg>
);

interface Props {
  /** URL de l'image à afficher plein écran. null/undefined = modal fermée. */
  uri: string | null | undefined;
  onClose: () => void;
}

/**
 * Affiche une image en plein écran (contentFit contain → vue complète, sans rognage).
 * Ouvert via appui long court (250 ms) sur produit / photo galerie / logo.
 */
export default function ImageZoomModal({ uri, onClose }: Props) {
  return (
    <Modal
      visible={!!uri}
      transparent
      presentationStyle="overFullScreen"
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <IcoClose />
        </TouchableOpacity>
        {uri ? (
          <ExpoImage source={{ uri }} style={styles.img} contentFit="contain" transition={120} />
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,7,18,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,21,42,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
