import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { colors, fonts, radius } from '../../theme';
import { extraireProduits, ProduitExtrait } from '../../utils/menuParser';

interface Props {
  onProduitsExtraits: (produits: ProduitExtrait[]) => void;
}

export default function ScannerMenu({ onProduitsExtraits }: Props) {
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const prendrePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorisez la caméra pour scanner votre menu.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
      mediaTypes: ['images'],
    });

    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    await analyserImage(uri);
  };

  const choisirDepuisGalerie = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "Autorisez l'accès aux photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      mediaTypes: ['images'],
    });

    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    await analyserImage(uri);
  };

  const analyserImage = async (uri: string) => {
    setLoading(true);
    try {
      const resultat = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
      const texteComplet = resultat.text;

      if (!texteComplet || texteComplet.trim().length < 5) {
        Alert.alert(
          'Rien détecté',
          'Aucun texte lisible sur cette photo. Reprenez une photo bien nette, à plat, avec une bonne lumière.',
        );
        return;
      }

      const produits = extraireProduits(texteComplet);

      if (produits.length === 0) {
        Alert.alert(
          'Aucun produit détecté',
          "Le texte a été lu mais aucun prix n'a été reconnu. Vous pouvez ajouter vos produits manuellement.",
        );
        return;
      }

      onProduitsExtraits(produits);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'analyser cette photo. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>📷 Scanner mon menu</Text>
      <Text style={s.subtitle}>
        Prenez une photo de votre menu existant — LASSİ va essayer de reconnaître
        vos plats et leurs prix automatiquement.
      </Text>

      {photoUri && (
        <Image source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
      )}

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.loadingText}>Analyse en cours…</Text>
        </View>
      ) : (
        <View style={s.buttons}>
          <TouchableOpacity style={s.btnPrimary} onPress={prendrePhoto} activeOpacity={0.85}>
            <Text style={s.btnPrimaryText}>📸 Prendre une photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={choisirDepuisGalerie} activeOpacity={0.85}>
            <Text style={s.btnSecondaryText}>🖼️ Choisir depuis la galerie</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={s.hint}>
        💡 Astuce : posez le menu bien à plat, cadrez tout le texte, évitez les ombres.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.accent,
    fontFamily: fonts.title,
    fontSize: 18,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  buttons: { gap: 10 },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  loadingBox: {
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
  },
});
