import { Share } from 'react-native';
import { genererTextePartage } from './deepLinks';
import type { BlocALaUne } from '../types/aLaUne';

export { lienElement, lienBloc, lienCategorie, genererTextePartage } from './deepLinks';

export const partagerBloc = async (bloc: BlocALaUne, nomCategorie: string): Promise<void> => {
  const message = genererTextePartage({
    titre: bloc.titre,
    description: bloc.description ?? undefined,
    elements: bloc.elements,
    blocCode: bloc.code ?? bloc.id,
    categorieId: bloc.categorie_id,
    nomCategorie,
    expireAt: bloc.expire_at,
  });
  try { await Share.share({ message }); } catch {}
};
