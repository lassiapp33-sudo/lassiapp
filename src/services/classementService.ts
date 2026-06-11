import { supabase } from '../lib/supabase';

export interface ClassementEntry {
  rang: number;
  points: number;
  nom_affiche: string;
  image_url?: string;
  prestataire_id?: string;
  client_id?: string;
}

export interface RecompenseAttribuee {
  id: string;
  prestataire_id: string | null;
  client_id: string | null;
  type_classement: string;
  periode: string;
  rang: number;
  badge: string | null;
  certificat: boolean;
  priorite_recherche: boolean;
  credit_lassi: number;
  carrousel_produits: number;
  top_vip: boolean;
  valide_jusqu_a: string | null;
  est_actif: boolean;
  created_at: string;
}

export interface CarrouselItem {
  id: string;
  prestataire_id: string;
  product_id: string | null;
  nom: string;
  prix: number;
  image_url: string;
  rang_prestataire: number | null;
  ordre: number;
  periode: string;
  est_actif: boolean;
  created_at: string;
}

// Cache mémoire simple (évite de recharger à chaque ouverture)
const cache = new Map<string, { data: ClassementEntry[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

const getCached = (key: string) => {
  const c = cache.get(key);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  return null;
};

// --- Classement sous-catégorie (hebdo) ---
export const getClassementSousCategorie = async (
  sousCategorie: string,
  periode: string,
): Promise<ClassementEntry[]> => {
  const key = `sc-${sousCategorie}-${periode}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('classements')
    .select('rang, points, nom_affiche, image_url, prestataire_id')
    .eq('type', 'sous_categorie')
    .eq('sous_categorie', sousCategorie)
    .eq('periode', periode)
    .eq('est_actif', true)
    .order('rang')
    .limit(20);
  if (error) throw new Error(error.message);
  cache.set(key, { data: data ?? [], ts: Date.now() });
  return data ?? [];
};

// --- Classement mondial (mensuel) — pagination ---
export const getClassementMondial = async (
  periode: string,
  page = 0,
  pageSize = 10,
): Promise<ClassementEntry[]> => {
  const { data, error } = await supabase
    .from('classements')
    .select('rang, points, nom_affiche, image_url, prestataire_id')
    .eq('type', 'mondial')
    .eq('periode', periode)
    .eq('est_actif', true)
    .order('rang')
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Classement quartiers ---
export const getClassementQuartiers = async (periode: string): Promise<ClassementEntry[]> => {
  const { data, error } = await supabase
    .from('classements')
    .select('rang, points, nom_affiche')
    .eq('type', 'quartier')
    .eq('periode', periode)
    .eq('est_actif', true)
    .order('rang')
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Classement clients ---
export const getClassementClients = async (periode: string): Promise<ClassementEntry[]> => {
  const { data, error } = await supabase
    .from('classements')
    .select('rang, points, nom_affiche, image_url, client_id')
    .eq('type', 'client')
    .eq('periode', periode)
    .eq('est_actif', true)
    .order('rang')
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Mes récompenses (prestataire) ---
export const getMesRecompenses = async (prestataireId: string): Promise<RecompenseAttribuee[]> => {
  const { data, error } = await supabase
    .from('recompenses_attribuees')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .eq('est_actif', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Carrousel Offre di Quartier (top 5 mondial) ---
export const getCarrouselOffreQuartier = async (): Promise<CarrouselItem[]> => {
  const { data, error } = await supabase
    .from('carrousel_offre_quartier')
    .select('*')
    .eq('est_actif', true)
    .order('ordre')
    .limit(25); // max 5 prestataires × 5 produits (CLASSEMENT_CONFIG.CARROUSEL_MAX_PRESTATAIRES)
  if (error) throw new Error(error.message);
  return data ?? [];
};

// ============================================================
// Helpers période
// ============================================================
// Les snapshots de `classements` représentent toujours la PÉRIODE QUI VIENT
// DE SE TERMINER : pg_cron calcule le classement de la semaine/du mois
// précédent et l'active pour toute la période en cours (voir
// 20260611130000_cron_classements.sql). Ces helpers renvoient donc la
// période ACTIVE (précédente), pas la période en cours — sinon les requêtes
// `getClassementXxx(periode)` ne trouveraient jamais de ligne `est_actif=true`.

/**
 * Semaine ISO 8601 (IYYY-SWW) de la période active — même format que
 * `to_char(now(), 'IYYY') || '-S' || to_char(now(), 'IW')` côté SQL.
 */
export const getPeriodeSemaine = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7); // la période active est la semaine précédente

  // Algorithme ISO 8601 standard : le jeudi de la semaine détermine l'année ISO
  const dayNum = d.getUTCDay() || 7; // dimanche=0 → 7 ; lundi=1 … dimanche=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);

  return `${isoYear}-S${String(week).padStart(2, '0')}`;
};

/**
 * Mois (YYYY-MM) de la période active — même format que
 * `to_char(now() - interval '1 day', 'YYYY-MM')` côté SQL.
 */
export const getPeriodeMois = (): string => {
  const d = new Date();
  d.setDate(1); // évite le débordement de fin de mois (ex: 31 mars - 1 mois)
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
