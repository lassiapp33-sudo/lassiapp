// Les polices VIP sont chargées globalement dans App.tsx avec le splash natif.
// Ce fichier expose uniquement les alias par gabarit pour que les composants
// n'aient pas à hardcoder les noms de font strings.
// Aucun useFonts() ici — il n'y en a qu'un seul dans toute l'app (App.tsx).

import { royal } from './theme';

export const VIP_FONTS = {
  palais: {
    titre:    'Cinzel_500Medium',
    titreSm:  'Cinzel_400Regular',
    titreLg:  'Cinzel_600SemiBold',
    corps:    royal.police.corps,
    corpsIt:  royal.police.corpsIt,
    util:     royal.police.util,
    utilLight:'Inter_300Light',
  },
  maison: {
    titre:    'Marcellus_400Regular',
    titreSm:  'Marcellus_400Regular',
    titreLg:  'Marcellus_400Regular',
    corps:    'Lora_400Regular',
    corpsIt:  'Lora_400Regular_Italic',
    semi:     'Lora_500Medium',
    util:     royal.police.util,
    utilLight:'Inter_300Light',
  },
} as const;
