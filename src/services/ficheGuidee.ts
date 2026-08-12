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

const TTL_MS = 24 * 60 * 60 * 1000;
const cacheKey = (sousCatId: string) => `lassi_suggs_${sousCatId}`;

async function lireCache(sousCatId: string): Promise<ToutesSuggestions | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(sousCatId));
    if (!raw) return null;
    const { ts, data }: { ts: number; data: ToutesSuggestions } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function ecrireCache(sousCatId: string, data: ToutesSuggestions): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(sousCatId), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

const getSuggestions = async (
  sousCatId: string,
  section: Section,
): Promise<Suggestion[]> => {
  const { data, error } = await supabase
    .from('suggestions_fiche')
    .select('id, valeur, ordre')
    .eq('sous_categorie_id', sousCatId)   // ← requête par sous-catégorie exacte
    .eq('section', section)
    .eq('actif', true)
    .order('ordre', { ascending: true });

  if (error) return [];
  return data ?? [];
};

// Charge les 4 sections en parallèle pour la sous-catégorie du marchand, cache 24h
export const getToutesSuggestions = async (sousCatId: string): Promise<ToutesSuggestions> => {
  const cached = await lireCache(sousCatId);
  if (cached) return cached;

  const sections: Section[] = ['type_contenu', 'sous_categorie_produit', 'nom_produit', 'prix'];
  const results = await Promise.all(sections.map(s => getSuggestions(sousCatId, s)));

  const data: ToutesSuggestions = {
    typeContenu:   results[0],
    sousCategorie: results[1],
    nomProduit:    results[2],
    prix:          results[3],
  };

  await ecrireCache(sousCatId, data);
  return data;
};
