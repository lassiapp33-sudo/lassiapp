import { SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';

export type FicheSection =
  | 'type_contenu'
  | 'sous_categorie_produit'
  | 'nom_produit'
  | 'prix';

export interface SuggestionFiche {
  id: string;
  categorie_id: string;
  sous_categorie_id: string | null;
  section: FicheSection;
  valeur: string;
  ordre: number;
}

export async function getSuggestions(
  categorieId: string,
  section: FicheSection,
  sousCategorieId?: string,
): Promise<SuggestionFiche[]> {
  let url =
    `${SUPABASE_URL}/rest/v1/suggestions_fiche` +
    `?select=id,categorie_id,sous_categorie_id,section,valeur,ordre` +
    `&categorie_id=eq.${encodeURIComponent(categorieId)}` +
    `&section=eq.${encodeURIComponent(section)}` +
    `&actif=eq.true` +
    `&order=ordre.asc`;

  if (sousCategorieId) {
    url += `&or=(sous_categorie_id.eq.${encodeURIComponent(sousCategorieId)},sous_categorie_id.is.null)`;
  }

  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) return [];
  const data: SuggestionFiche[] = await res.json();
  return data ?? [];
}

export async function getAllSuggestions(categorieId: string): Promise<SuggestionFiche[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/suggestions_fiche` +
    `?select=id,categorie_id,sous_categorie_id,section,valeur,ordre` +
    `&categorie_id=eq.${encodeURIComponent(categorieId)}` +
    `&actif=eq.true` +
    `&order=section.asc,ordre.asc`;

  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) return [];
  const data: SuggestionFiche[] = await res.json();
  return data ?? [];
}
