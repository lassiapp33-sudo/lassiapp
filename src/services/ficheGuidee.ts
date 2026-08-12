import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface Suggestion {
  id: string;
  valeur: string;
  ordre: number;
}

type Section = 'type_contenu' | 'sous_categorie_produit' | 'nom_produit' | 'prix';

export interface ToutesSuggestions {
  typeContenu:   Suggestion[];
  sousCategorie: Suggestion[];
  nomProduit:    Suggestion[];
  prix:          Suggestion[];
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const cacheKey = (catId: string) => `lassi_suggs_${catId}`;

async function lireCache(catId: string): Promise<ToutesSuggestions | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(catId));
    if (!raw) return null;
    const { ts, data }: { ts: number; data: ToutesSuggestions } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function ecrireCache(catId: string, data: ToutesSuggestions): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(catId), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // cache write failure is non-fatal
  }
}

const getSuggestions = async (
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

// Charge les 4 sections en parallèle, avec cache 24h
export const getToutesSuggestions = async (categorieId: string): Promise<ToutesSuggestions> => {
  const cached = await lireCache(categorieId);
  if (cached) return cached;

  const sections: Section[] = ['type_contenu', 'sous_categorie_produit', 'nom_produit', 'prix'];
  const results = await Promise.all(sections.map(s => getSuggestions(categorieId, s)));

  const data: ToutesSuggestions = {
    typeContenu:   results[0],
    sousCategorie: results[1],
    nomProduit:    results[2],
    prix:          results[3],
  };

  await ecrireCache(categorieId, data);
  return data;
};
