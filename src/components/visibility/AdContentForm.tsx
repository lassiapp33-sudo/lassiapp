import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';

const FORM_W = Dimensions.get('window').width - 36; // marginHorizontal: 18 × 2
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

const IcoCamera = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" stroke={colors.accent} />
    <Circle cx={12} cy={13} r={3} stroke={colors.accent} />
  </Svg>
);
import { AdFormat } from '../../services/sponsoredAds';
import * as storageService from '../../services/storage';

export interface AdContent {
  titre: string;
  corps: string;
  imageUri: string | null;   // URI locale avant upload
  imageUrl: string | null;   // URL Supabase après upload
}

interface Props {
  format: AdFormat;
  content: AdContent;
  onChange: (c: AdContent) => void;
  uploading: boolean;
  onSetUploading: (v: boolean) => void;
  shopId: string;
}

export default function AdContentForm({
  format,
  content,
  onChange,
  uploading,
  onSetUploading,
  shopId,
}: Props) {
  const pickImage = async () => {
    const uri = await storageService.pickGalleryImage();
    if (!uri) return;

    onChange({ ...content, imageUri: uri, imageUrl: null });
    onSetUploading(true);
    try {
      const path = `ads/${shopId}/${Date.now()}.jpg`;
      const url = await storageService.uploadImage('products', uri, path);
      onChange({ ...content, imageUri: uri, imageUrl: url });
    } catch {
      Alert.alert('Erreur', "Impossible d'uploader l'image. Réessaie.");
      onChange({ ...content, imageUri: null, imageUrl: null });
    } finally {
      onSetUploading(false);
    }
  };

  const removeImage = () => {
    onChange({ ...content, imageUri: null, imageUrl: null });
  };

  if (format === 'affiche') {
    return (
      <View style={s.wrap}>
        <Text style={s.hint}>
          L'affiche est affichée en plein écran chez les clients. Utilise une image portrait (3:4 recommandé).
        </Text>
        <ImagePicker
          uri={content.imageUri}
          uploading={uploading}
          onPick={pickImage}
          onRemove={removeImage}
          required
        />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* Titre */}
      <Text style={s.fieldLabel}>Titre de l'annonce *</Text>
      <TextInput
        style={s.input}
        placeholder="Ex : Nouveau menu disponible !"
        placeholderTextColor={colors.muted}
        value={content.titre}
        onChangeText={v => onChange({ ...content, titre: v })}
        maxLength={60}
      />
      <Text style={s.counter}>{content.titre.length}/60</Text>

      {/* Corps */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Description *</Text>
      <TextInput
        style={[s.input, s.inputMulti]}
        placeholder="Décris ton offre, ta nouveauté ou ton événement…"
        placeholderTextColor={colors.muted}
        value={content.corps}
        onChangeText={v => onChange({ ...content, corps: v })}
        multiline
        numberOfLines={3}
        maxLength={200}
        textAlignVertical="top"
      />
      <Text style={s.counter}>{content.corps.length}/200</Text>

      {/* Image optionnelle */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Image (optionnelle)</Text>
      <ImagePicker
        uri={content.imageUri}
        uploading={uploading}
        onPick={pickImage}
        onRemove={removeImage}
      />
    </View>
  );
}

// ─── Sous-composant ImagePicker ───────────────────────────────────────────────

function ImagePicker({
  uri,
  uploading,
  onPick,
  onRemove,
  required,
}: {
  uri: string | null;
  uploading: boolean;
  onPick: () => void;
  onRemove: () => void;
  required?: boolean;
}) {
  const [imgRatio, setImgRatio] = useState<number>(3 / 4);

  useEffect(() => {
    if (uri) {
      Image.getSize(
        uri,
        (w, h) => { if (w && h) setImgRatio(w / h); },
        () => {},
      );
    }
  }, [uri]);

  const previewHeight = Math.round(FORM_W / imgRatio);

  if (uri) {
    return (
      <View style={s.imagePreviewWrap}>
        <Image source={{ uri }} style={[s.imagePreview, { height: previewHeight }]} resizeMode="cover" />
        {uploading && (
          <View style={s.uploadOverlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.uploadTxt}>Upload…</Text>
          </View>
        )}
        {!uploading && (
          <TouchableOpacity style={s.removeBtn} onPress={onRemove} activeOpacity={0.8}>
            <Text style={s.removeTxt}>✕ Supprimer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity style={s.imagePicker} onPress={onPick} activeOpacity={0.82}>
      <IcoCamera />
      <Text style={s.imagePickerTxt}>
        {required ? 'Ajouter une image *' : 'Ajouter une image'}
      </Text>
      <Text style={s.imagePickerHint}>Galerie photo</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginBottom: 22 },

  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },

  fieldLabel: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
    marginBottom: 8,
  },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  inputMulti: {
    minHeight: 80,
    paddingTop: 12,
  },

  counter: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },

  // Image picker vide
  imagePicker: {
    height: 110,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePickerTxt: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  imagePickerHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },

  // Image sélectionnée
  imagePreviewWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    borderRadius: radius.lg,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadTxt: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  removeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  removeTxt: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
});
