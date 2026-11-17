/**
 * services/storage.ts — Upload et gestion des images dans Supabase Storage.
 *
 * Flux : sélection → compression (max 1080px, 75%) → upload → URL publique.
 * Crucial pour Dakar : images compressées = chargement rapide même sur réseau lent.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import { supabase, SUPABASE_URL, SUPABASE_ANON, getValidToken } from '../lib/supabase';

// ─── Compression ──────────────────────────────────────────────────────────────

/**
 * Redimensionne et compresse une image locale avant upload.
 * Retourne l'URI de l'image compressée (nouvelle API expo-image-manipulator v14).
 */
export async function compressImage(localUri: string): Promise<string> {
  // L'API v14 `ImageManipulator.manipulate()` peut throw sur certaines photos
  // iPhone (HEIC 10-bit, profil couleur large gamut, original iCloud non
  // téléchargé). Dans ce cas on NE bloque PAS l'upload : on retombe sur
  // l'image d'origine plutôt que d'échouer. Cause racine du bug
  // « marche sur certains iPhone, pas d'autres » (photos catalogue pro).
  try {
    const imageRef = await ImageManipulator.manipulate(localUri)
      .resize({ width: 800 })
      .renderAsync();
    const result = await imageRef.saveAsync({
      compress: 0.70,
      format: SaveFormat.JPEG,
    });
    // Vérifie que le fichier compressé n'est pas vide (iCloud non téléchargé).
    const info = await FileSystem.getInfoAsync(result.uri);
    if (info.exists && (info.size ?? 0) > 0) return result.uri;
    return localUri;
  } catch {
    // Compression impossible → on tente l'upload de l'original tel quel.
    return localUri;
  }
}

// ─── Picker ───────────────────────────────────────────────────────────────────

/**
 * Vérifie/demande une permission. Si refusée définitivement (canAskAgain=false,
 * ex. l'utilisateur a déjà dit non), affiche une alerte avec accès aux Réglages
 * au lieu d'échouer silencieusement (bug « la galerie ne répond pas » iOS/Android).
 * Retourne true si accès accordé.
 */
async function ensurePermission(kind: 'library' | 'camera'): Promise<boolean> {
  const req =
    kind === 'library'
      ? ImagePicker.requestMediaLibraryPermissionsAsync()
      : ImagePicker.requestCameraPermissionsAsync();
  const { status, canAskAgain } = await req;
  if (status === 'granted') return true;

  const quoi = kind === 'library' ? 'aux photos' : 'à la caméra';
  if (!canAskAgain) {
    Alert.alert(
      'Autorisation requise',
      `L'accès ${quoi} est bloqué. Ouvre les Réglages pour l'autoriser.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir Réglages', onPress: () => Linking.openSettings() },
      ],
    );
  }
  return false;
}

/**
 * Ouvre la galerie photo.
 * Retourne l'URI locale de l'image choisie, ou null si annulé/refus.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  if (!(await ensurePermission('library'))) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1, // compression faite par compressImage()
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Ouvre la caméra.
 * Retourne l'URI locale de la photo prise, ou null si annulé/refus.
 */
export async function pickImageFromCamera(): Promise<string | null> {
  if (!(await ensurePermission('camera'))) return null;

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
  bucket:
    | 'logos'
    | 'products'
    | 'covers'
    | 'avatars'
    | 'gallery'
    | 'signalements'
    | 'avis'
    | 'disputes'
    | 'stories'
    | 'beauty',
  localUri: string,
  path: string,
): Promise<string> {
  // 1. Compression avant envoi (fallback original si manipulate échoue)
  const compressedUri = await compressImage(localUri);

  // 1b. Garde-fou : fichier introuvable/vide (original iCloud non téléchargé).
  //     Message explicite plutôt qu'« Upload échoué : 400 » opaque.
  const fileInfo = await FileSystem.getInfoAsync(compressedUri);
  if (!fileInfo.exists || (fileInfo.size ?? 0) === 0) {
    throw new Error(
      'Photo introuvable sur l\'appareil. Si elle est stockée sur iCloud, ouvre-la une fois dans Photos puis réessaie.',
    );
  }

  // 2. JWT utilisateur — getValidToken() rafraîchit si expiré. getSession() brut
  //    pouvait rendre un access_token périmé → EF getUser() renvoie « Token
  //    invalide » (401) sur les comptes à session ancienne → upload échoue pour
  //    CE prestataire seulement (cause « marche chez certains, pas d'autres »).
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch {
    throw new Error('Session expirée. Déconnecte-toi et reconnecte-toi, puis réessaie.');
  }
  if (!accessToken) throw new Error('Non connecté');

  // 3. Upload via Edge Function — FileSystem.uploadAsync évite le bug Android où
  //    fetch(body: Uint8Array) envoie un body vide sur Hermes.
  //    Content-Type déduit de l'extension (le fallback non compressé peut être HEIC/PNG).
  const lower = compressedUri.toLowerCase();
  const contentType =
    lower.endsWith('.png') ? 'image/png'
    : lower.endsWith('.heic') || lower.endsWith('.heif') ? 'image/heic'
    : lower.endsWith('.webp') ? 'image/webp'
    : 'image/jpeg';
  const fnUrl = `${SUPABASE_URL}/functions/v1/upload-image`;
  const uploadRes = await FileSystem.uploadAsync(fnUrl, compressedUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON,
      'Content-Type': contentType,
      'x-bucket': bucket,
      'x-path': path,
    },
  });

  const result = JSON.parse(uploadRes.body) as { url?: string; error?: string };
  if (uploadRes.status < 200 || uploadRes.status >= 300 || !result.url) {
    throw new Error(`Upload échoué : ${result.error ?? uploadRes.status}`);
  }

  return result.url;
}

/**
 * Uploade une vidéo courte (présentation vitrine) vers Supabase Storage.
 * Pas de compression côté manipulator (c'est une vidéo) — la réduction de taille
 * est faite en amont par le picker (preset bas + durée max courte). Retourne l'URL.
 */
export async function uploadVideo(localUri: string, path: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || (info.size ?? 0) === 0) {
    throw new Error('Vidéo introuvable sur l\'appareil. Réessaie.');
  }
  // Garde-fou taille : refuse > 30 Mo (la vidéo doit rester très compressée).
  if ((info.size ?? 0) > 30 * 1024 * 1024) {
    throw new Error('Vidéo trop lourde (max 30 Mo). Choisis une vidéo plus courte.');
  }
  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch {
    throw new Error('Session expirée. Reconnecte-toi et réessaie.');
  }
  if (!accessToken) throw new Error('Non connecté');

  const lower = localUri.toLowerCase();
  const contentType = lower.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const fnUrl = `${SUPABASE_URL}/functions/v1/upload-image`;
  const uploadRes = await FileSystem.uploadAsync(fnUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON,
      'Content-Type': contentType,
      'x-bucket': 'gallery',
      'x-path': path,
    },
  });
  const result = JSON.parse(uploadRes.body) as { url?: string; error?: string };
  if (uploadRes.status < 200 || uploadRes.status >= 300 || !result.url) {
    throw new Error(`Upload vidéo échoué : ${result.error ?? uploadRes.status}`);
  }
  return result.url;
}

/**
 * Supprime une image de Supabase Storage.
 */
export async function deleteImage(
  bucket: 'logos' | 'products' | 'covers' | 'avatars' | 'gallery' | 'signalements' | 'avis',
  path: string,
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
 * Génère un chemin unique pour un média de story « Ça bouge ».
 * Stocké dans le bucket 'stories'.
 */
export function storyImagePath(shopId: string): string {
  return `${shopId}/story_${Date.now()}.jpg`;
}

/**
 * Ouvre la galerie sans forcer le recadrage carré (pour les photos de boutique).
 */
export async function pickGalleryImage(): Promise<string | null> {
  if (!(await ensurePermission('library'))) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}
