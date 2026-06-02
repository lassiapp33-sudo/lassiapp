/**
 * services/storage.ts — Upload et gestion des images dans Supabase Storage.
 *
 * Flux : sélection → compression (max 1080px, 75%) → upload → URL publique.
 * Crucial pour Dakar : images compressées = chargement rapide même sur réseau lent.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker      from 'expo-image-picker';
import { supabase }          from '../lib/supabase';

// ─── Compression ──────────────────────────────────────────────────────────────

/**
 * Redimensionne et compresse une image locale avant upload.
 * Retourne l'URI de l'image compressée.
 */
async function compressImage(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],        // max 1080px de large
    {
      compress: 0.75,                       // 75% qualité (bon compromis taille/qualité)
      format:   ImageManipulator.SaveFormat.JPEG,
    },
  );
  return result.uri;
}

// ─── Picker ───────────────────────────────────────────────────────────────────

/**
 * Ouvre la galerie photo.
 * Retourne l'URI locale de l'image choisie, ou null si annulé/refus.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,                             // compression faite par compressImage()
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Ouvre la caméra.
 * Retourne l'URI locale de la photo prise, ou null si annulé/refus.
 */
export async function pickImageFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Compresse et uploade une image vers Supabase Storage.
 * Retourne l'URL publique.
 *
 * @param bucket  - 'logos' | 'products' | 'covers' | 'avatars'
 * @param localUri - URI locale (résultat du picker ou caméra)
 * @param path    - chemin dans le bucket, ex : "shop123/logo.jpg"
 */
export async function uploadImage(
  bucket:   'logos' | 'products' | 'covers' | 'avatars' | 'gallery' | 'signalements' | 'avis',
  localUri: string,
  path:     string,
): Promise<string> {
  // 1. Compression avant envoi
  const compressedUri = await compressImage(localUri);

  // 2. Fetch en ArrayBuffer (fiable sur React Native, contrairement à blob)
  const response    = await fetch(compressedUri);
  const arrayBuffer = await response.arrayBuffer();

  // 3. Upload vers Supabase Storage
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert:      true,             // écrase si le fichier existe déjà
    });

  if (error) throw new Error(`Upload échoué : ${error.message}`);

  // 4. URL publique permanente
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Supprime une image de Supabase Storage.
 */
export async function deleteImage(
  bucket: 'logos' | 'products' | 'covers' | 'avatars' | 'gallery' | 'signalements' | 'avis',
  path:   string,
): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Génère un chemin unique pour un produit.
 * Format : products/{shopId}/{productId}_{timestamp}.jpg
 */
export function productImagePath(shopId: string, productId: string): string {
  return `${shopId}/${productId}_${Date.now()}.jpg`;
}

/**
 * Génère un chemin unique pour un logo boutique.
 */
export function logoPath(shopId: string): string {
  return `${shopId}/logo_${Date.now()}.jpg`;
}

/**
 * Génère un chemin unique pour une bannière boutique.
 */
export function coverPath(shopId: string): string {
  return `${shopId}/cover_${Date.now()}.jpg`;
}

/**
 * Génère un chemin unique pour un avatar utilisateur.
 */
export function avatarPath(userId: string): string {
  return `${userId}/avatar_${Date.now()}.jpg`;
}

/**
 * Génère un chemin unique pour une photo de galerie boutique.
 * Stocké dans le bucket 'gallery'.
 */
export function galleryImagePath(shopId: string): string {
  return `${shopId}/photo_${Date.now()}.jpg`;
}

/**
 * Ouvre la galerie sans forcer le recadrage carré (pour les photos de boutique).
 */
export async function pickGalleryImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}
