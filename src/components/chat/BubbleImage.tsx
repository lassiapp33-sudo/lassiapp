import React, { useState, useCallback } from 'react';
import {
  View, Image, Text, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator,
  Pressable, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem   from 'expo-file-system/legacy';
import { colors, fonts } from '../../theme';
import { getErrorMessage } from '../../utils/errorUtils';
import { IcoClose } from '../icons';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoDownload = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" />
    <Path d="m7 10 5 5 5-5"                               stroke="#fff" />
    <Path d="M12 15V3"                                     stroke="#fff" />
  </Svg>
);

// ─── Enregistrement dans la galerie ──────────────────────────────────────────

async function saveToGallery(imageUrl: string): Promise<void> {
  // 1. Demander la permission
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les réglages de l\'app.');
    return;
  }

  // 2. Télécharger l'image dans le cache temporaire
  const filename  = `lassi_${Date.now()}.jpg`;
  const localUri  = (FileSystem.cacheDirectory ?? '') + filename;

  const { uri } = await FileSystem.downloadAsync(imageUrl, localUri);

  // 3. Sauvegarder dans la galerie
  await MediaLibrary.saveToLibraryAsync(uri);

  // 4. Supprimer le fichier temporaire
  await FileSystem.deleteAsync(uri, { idempotent: true });

  Alert.alert('Enregistré ✓', 'L\'image a été sauvegardée dans ta galerie.');
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  sender:   'me' | 'them';
  imageUrl: string;
  time:     string;
  read?:    boolean;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function BubbleImage({ sender, imageUrl, time, read }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [saving,     setSaving]     = useState(false);

  const isMe    = sender === 'me';
  const bgColor = isMe ? '#FDCF34' : '#222447';
  const border  = isMe
    ? { borderBottomRightRadius: 5 }
    : { borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border };

  // ── Enregistrer (avec feedback) ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveToGallery(imageUrl);
    } catch (err: unknown) {
      Alert.alert('Erreur', getErrorMessage(err, 'Impossible d\'enregistrer l\'image.'));
    } finally {
      setSaving(false);
    }
  }, [imageUrl, saving]);

  // ── Long-press sur la bulle ───────────────────────────────────────────────
  const handleLongPress = useCallback(() => {
    Alert.alert('Image', '', [
      {
        text:    'Enregistrer dans la galerie',
        onPress: handleSave,
      },
      {
        text:    'Voir en grand',
        onPress: () => setFullscreen(true),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [handleSave]);

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>

      {/* ── Bulle image ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.bubble, { backgroundColor: bgColor }, border]}
        onPress={() => setFullscreen(true)}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.9}
      >
        {!loaded && (
          <View style={styles.placeholder}>
            <ActivityIndicator color={isMe ? colors.bg : colors.accent} size="small" />
          </View>
        )}
        <Image
          source={{ uri: imageUrl }}
          style={[styles.img, !loaded && { opacity: 0 }]}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
        />

        {/* Icône de sauvegarde en surimpression (coin bas-droit) */}
        {loaded && (
          <TouchableOpacity
            style={styles.saveOverlay}
            onPress={handleSave}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <IcoDownload />
            }
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem]}>
        {time}{isMe && read ? ' ✓✓' : isMe ? ' ✓' : ''}
      </Text>

      {/* ── Vue plein écran ───────────────────────────────────────── */}
      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setFullscreen(false)}>

          {/* Fermer */}
          <TouchableOpacity
            style={[styles.fabBtn, styles.fabClose]}
            onPress={() => setFullscreen(false)}
            activeOpacity={0.8}
          >
            <IcoClose color={colors.muted} />
          </TouchableOpacity>

          {/* Télécharger */}
          <TouchableOpacity
            style={[styles.fabBtn, styles.fabSave]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <IcoDownload />
            }
          </TouchableOpacity>

          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImg}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row:      { maxWidth: '75%' },
  rowMe:    { alignSelf: 'flex-end',   alignItems: 'flex-end'   },
  rowThem:  { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: {
    borderRadius: 18,
    overflow:     'hidden',
    width:        220,
    height:       180,
  },

  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#1a1c3a',
  },

  img: {
    width:  '100%',
    height: '100%',
  },

  // Bouton téléchargement en surimpression sur la miniature
  saveOverlay: {
    position:        'absolute',
    bottom:          8,
    right:           8,
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  time: {
    color:      '#5a5c80',
    fontFamily: fonts.body,
    fontSize:   9.5,
    marginTop:  4,
  },
  timeMe:   { marginRight: 3 },
  timeThem: { marginLeft:  3 },

  // Plein écran
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent:  'center',
    alignItems:      'center',
  },

  fabBtn: {
    position:        'absolute',
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  },
  fabClose: { top: 56, right: 20 },
  fabSave:  { top: 56, left:  20 },

  fullImg: {
    width:  '100%',
    height: '80%',
  },
});
