/**
 * Avatar — Composant unique pour afficher une image de profil ou un logo dans toute l'app.
 *
 * Logique d'affichage (priorité) :
 *  1. Si `uploading` → spinner de chargement
 *  2. Si `imageUrl` est fourni et image valide → Image réelle (Supabase Storage)
 *  3. Sinon → initiale du nom sur fond coloré (fallback universel)
 *
 * Source de vérité : authStore.user.avatarUrl (profils) / shopStore.profile.logoUrl (boutiques).
 * La prop `key={imageUrl}` sur Image force le rechargement automatique si l'URL change
 * après un nouvel upload (l'URL inclut un timestamp unique, donc pas besoin d'invalider le cache).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts } from '../theme';
import { getInitials } from '../utils/getInitials';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AvatarProps {
  /** URL Supabase Storage (avatar_url ou logo_url). Si absent → fallback initiale. */
  imageUrl?: string | null;
  /** Nom complet — sert au calcul de l'initiale en fallback. */
  name: string;
  /** Taille en pixels (width = height). */
  size: number;
  /** Forme et couleurs :
   *  - 'user'  → rond, fond surface, initiale accent
   *  - 'shop'  → carré arrondi, fond accent jaune, initiale bg
   */
  variant?: 'user' | 'shop';
  /**
   * Affiche une bordure mise en valeur :
   *  - user  → 2px colors.accent
   *  - shop  → 3px colors.bg (effet flottant sur la bannière)
   */
  showBorder?: boolean;
  /** Rend le composant pressable. */
  onPress?: () => void;
  /** Affiche un spinner à la place de l'image (pendant l'upload). */
  uploading?: boolean;
  /** Style additionnel appliqué au conteneur (ex. marges). */
  style?: StyleProp<ViewStyle>;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function Avatar({
  imageUrl,
  name,
  size,
  variant = 'user',
  showBorder = false,
  onPress,
  uploading = false,
  style,
}: AvatarProps) {
  // Réinitialise l'état d'erreur quand l'URL change (nouvelle photo uploadée)
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  // ── Géométrie ────────────────────────────────────────────────────────────
  const borderRadius =
    variant === 'user'
      ? size / 2 // Rond parfait pour les utilisateurs
      : Math.round(size * 0.27); // Carré arrondi (ratio extrait des designs existants)

  // ── Couleurs ─────────────────────────────────────────────────────────────
  const bgColor = variant === 'shop' ? colors.accent : colors.surface;
  const initialColor = variant === 'shop' ? colors.bg : colors.accent;
  const fontSize = Math.round(size * 0.38);

  // ── Bordure ───────────────────────────────────────────────────────────────
  let borderWidth: number;
  let borderColor: string;
  if (showBorder) {
    borderWidth = variant === 'user' ? 2 : 3;
    borderColor = variant === 'user' ? colors.accent : colors.bg;
  } else {
    borderWidth = variant === 'user' ? 1 : 0;
    borderColor = colors.border;
  }

  const containerStyle = [
    styles.base,
    {
      width: size,
      height: size,
      borderRadius,
      backgroundColor: bgColor,
      borderWidth,
      borderColor,
    },
    style,
  ];

  // ── Contenu ───────────────────────────────────────────────────────────────
  const showImage = !!imageUrl && !hasError;

  const inner = uploading ? (
    // Spinner pendant l'upload
    <ActivityIndicator color={variant === 'shop' ? colors.bg : colors.accent} size="small" />
  ) : showImage ? (
    // Image réelle depuis Supabase Storage — expo-image : cache disque + transition
    <Image
      key={imageUrl}
      source={{ uri: imageUrl }}
      style={{ width: size, height: size, borderRadius }}
      contentFit="cover"
      transition={150}
      onError={() => setHasError(true)}
    />
  ) : (
    // Fallback : initiale sur fond coloré
    <Text style={{ fontFamily: fonts.titleXL, fontSize, color: initialColor }}>
      {getInitials(name)}
    </Text>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={containerStyle}>{inner}</View>;
}

// ─── Styles base ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden', // clip l'image au borderRadius
  },
});
