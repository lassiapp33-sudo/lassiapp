import { Platform, StatusBar } from 'react-native';

// Fondation visuelle de toute l'app — importer uniquement depuis ce fichier

// Padding top universel tenant compte de la status bar
export const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 54;
export const colors = {
  bg: '#14152A', // bleu nuit — fond principal
  accent: '#FDCF34', // jaune — CTA et actions importantes uniquement
  white: '#FFFFFF', // texte principal
  muted: '#9A9BB0', // texte secondaire
  surface: '#1E2040', // cartes, surfaces
  border: '#2A2C52', // bordures subtiles
  success: '#5FD38A', // statut ouvert
  danger: '#E07A7A', // statut fermé / erreur
  orange: '#F0A847', // alertes douces, statut "en cours"
} as const;

export const radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 22,
  pill: 999,
} as const;

// Marges latérales écran standard
export const spacing = {
  screen: 24,
} as const;

export const fonts = {
  title: 'PlusJakartaSans_700Bold',
  titleXL: 'PlusJakartaSans_800ExtraBold',
  ui: 'PlusJakartaSans_600SemiBold',
  body: 'Poppins_300Light',
  label: 'PlusJakartaSans_500Medium',
} as const;
