import { supabase } from '../lib/supabase';

export interface Suggestion {
  id: string;
  valeur: string;
  ordre: number;
}

type Section = 'type_contenu' | 'sous_categorie_produit' | 'nom_produit' | 'prix';

export const getSuggestions = async (
  categorieId: string,
  section: Section,
): Promise<Suggestion[]> => {
  const { data, error } = await supabase
    .from('suggestions_fiche')
    .select('id, valeur, ordre')
    .eq('categorie_id', categorieId)
    .eq('section', section)
    .eq('actif', true)
    .order('ordre', { ascending: true });

  if (error) return [];
  return data ?? [];
};

// Charge les 4 sections en parallèle (évite 4 allers-retours séquentiels)
export const getToutesSuggestions = async (categorieId: string) => {
  const sections: Section[] = ['type_contenu', 'sous_categorie_produit', 'nom_produit', 'prix'];
  const results = await Promise.all(sections.map(s => getSuggestions(categorieId, s)));
  return {
    typeContenu:   results[0],
    sousCategorie: results[1],
    nomProduit:    results[2],
    prix:          results[3],
  };
};
