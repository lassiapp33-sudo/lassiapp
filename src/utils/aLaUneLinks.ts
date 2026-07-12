import { Share } from 'react-native';
import { genererTextePartage } from './deepLinks';
import type { BlocALaUne } from '../types/aLaUne';

// Re-exports pour l'accès centralisé
export { lienElement, lienCategorie, genererTextePartage } from './deepLinks';

/**
 * Ouvre le panneau de partage natif (WhatsApp, Facebook, Instagram, TikTok…)
 * avec le texte complet généré par LASSİ — non modifiable par le prestataire.
 */
export const partagerBloc = async (bloc: BlocALaUne, nomCategorie: string): Promise<void> => {
  const message = genererTextePartage({
    titre: bloc.titre,
    description: bloc.description ?? undefined,
    elements: bloc.elements,
    blocId: bloc.id,
    categorieId: bloc.categorie_id,
    nomCategorie,
    expireAt: bloc.expire_at,
  });

  try {
    await Share.share({ message });
  } catch {
    // annulé par l'utilisateur
  }
};
