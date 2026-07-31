import { useFonts } from 'expo-font';
import { Cinzel_400Regular, Cinzel_500Medium } from '@expo-google-fonts/cinzel';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus';
import { EBGaramond_400Regular, EBGaramond_400Regular_Italic, EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Lora_400Regular, Lora_400Regular_Italic, Lora_500Medium } from '@expo-google-fonts/lora';
import { Inter_300Light, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

// Tokens de police par gabarit — à utiliser dans les composants VIP.
export const VIP_FONTS = {
  // Gabarit "palais" (Le Tapaba, restauration)
  palais: {
    titre:   'Cinzel_500Medium',   // h1, h2, h3
    accent:  'Cinzel_400Regular',  // prix, caps gravés
    corps:   'EBGaramond_400Regular',
    italique:'EBGaramond_400Regular_Italic',
    semi:    'EBGaramond_500Medium',
    ui:      'Inter_400Regular',
    uiLight: 'Inter_300Light',
    uiMedium:'Inter_500Medium',
  },
  // Gabarit "maison" (Maison Aïda, beauté/coiffure)
  maison: {
    titre:   'Marcellus_400Regular', // h1, h2, h3
    accent:  'Marcellus_400Regular', // prix
    corps:   'Lora_400Regular',
    italique:'Lora_400Regular_Italic',
    semi:    'Lora_500Medium',
    ui:      'Inter_400Regular',
    uiLight: 'Inter_300Light',
    uiMedium:'Inter_500Medium',
  },
} as const;

// Chargement paresseux : appelé uniquement dans les écrans VIP.
// Les polices de la charte principale (PlusJakartaSans, Poppins) sont
// chargées globalement dans App.tsx et restent indépendantes.
export function useVipFonts(): boolean {
  const [loaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_500Medium,
    Marcellus_400Regular,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
  });
  return loaded;
}
