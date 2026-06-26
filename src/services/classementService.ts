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
  terrain_id: string | null;
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

// --- Mes récompenses actives (prestataire) — exclut les expirées ---
export const getMesRecompenses = async (prestataireId: string): Promise<RecompenseAttribuee[]> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('recompenses_attribuees')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .eq('est_actif', true)
    .or(`valide_jusqu_a.is.null,valide_jusqu_a.gt.${now}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Badges actifs d'un prestataire (vitrine) ---
export const getBadgesActifs = async (prestataireId: string): Promise<RecompenseAttribuee[]> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('recompenses_attribuees')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .eq('est_actif', true)
    .or(`valide_jusqu_a.is.null,valide_jusqu_a.gt.${now}`)
    .order('rang');
  if (error) throw new Error(error.message);
  return data ?? [];
};

// --- Certificat actif d'un prestataire (meilleur rang avec certificat=true) ---
export const getCertificatActif = async (
  prestataireId: string,
): Promise<RecompenseAttribuee | null> => {
  const badges = await getBadgesActifs(prestataireId);
  return badges.find(r => r.certificat) ?? null;
};

// --- Meilleur badge actif de plusieurs prestataires (cartes de liste) ---
// Renvoie le badge de rang le plus bas par prestataire_id (données triées par rang).
export const getBadgesActifsBatch = async (
  prestataireIds: string[],
): Promise<Record<string, RecompenseAttribuee>> => {
  const ids = [...new Set(prestataireIds)];
  if (ids.length === 0) return {};

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('recompenses_attribuees')
    .select('*')
    .in('prestataire_id', ids)
    .eq('est_actif', true)
    .or(`valide_jusqu_a.is.null,valide_jusqu_a.gt.${now}`)
    .order('rang');
  if (error) throw new Error(error.message);

  const best: Record<string, RecompenseAttribuee> = {};
  for (const r of data ?? []) {
    if (r.prestataire_id && !best[r.prestataire_id]) best[r.prestataire_id] = r;
  }
  return best;
};

// --- Carrousel Offre du Quartier (top 5 mondial) ---
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

// --- Quota carrousel du prestataire connecté (récompense Top 5 mondial active) ---
export const getMonCarrouselQuota = async (
  prestataireId: string,
): Promise<RecompenseAttribuee | null> => {
  const recompenses = await getMesRecompenses(prestataireId);
  const eligibles = recompenses.filter(r => r.carrousel_produits > 0);
  if (eligibles.length === 0) return null;
  return eligibles.reduce((best, r) => (r.carrousel_produits > best.carrousel_produits ? r : best));
};

// --- Récompense de bienvenue (cadeau offert à la création du compte) ---
export const getRecompenseBienvenue = async (
  prestataireId: string,
): Promise<RecompenseAttribuee | null> => {
  const recompenses = await getMesRecompenses(prestataireId);
  return recompenses.find(r => r.type_classement === 'bienvenue') ?? null;
};

// --- Ma sélection actuelle pour le carrousel ---
export const getMesProduitsCarrousel = async (prestataireId: string): Promise<CarrouselItem[]> => {
  const { data, error } = await supabase
    .from('carrousel_offre_quartier')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .order('ordre');
  if (error) throw new Error(error.message);
  return data ?? [];
};

export interface CarrouselSelectionItem {
  productId?: string | null;
  terrainId?: string | null;
  nom: string;
  prix: number;
  imageUrl: string;
}

// --- Remplace ma sélection de produits mis en avant dans le carrousel ---
export const setCarrouselSelection = async (
  prestataireId: string,
  periode: string,
  rang: number,
  items: CarrouselSelectionItem[],
): Promise<void> => {
  const { error: delError } = await supabase
    .from('carrousel_offre_quartier')
    .delete()
    .eq('prestataire_id', prestataireId);
  if (delError) throw new Error(delError.message);

  if (items.length === 0) return;

  const rows = items.map((item, index) => ({
    prestataire_id: prestataireId,
    product_id: item.productId ?? null,
    terrain_id: item.terrainId ?? null,
    nom: item.nom,
    prix: item.prix,
    image_url: item.imageUrl,
    rang_prestataire: rang,
    ordre: index,
    periode,
    est_actif: true,
  }));

  const { error: insError } = await supabase.from('carrousel_offre_quartier').insert(rows);
  if (insError) throw new Error(insError.message);
};

// ============================================================
// Helpers période
// ============================================================
// - getPeriodeSemaine() : période ACTIVE = semaine précédente. "Ma
//   catégorie" est calculé chaque dimanche 23h59 et reste figé toute la
//   semaine suivante (20260611130000_cron_classements.sql).
// - getPeriodeMois() : période EN COURS = mois en cours. Mondial / Quartier
//   / Top clients sont un APERÇU LIVE du mois en cours, recalculé chaque
//   dimanche à partir des points cumulés depuis le 1er
//   (20260612140000_classement_mensuel_progressif.sql). Le calcul final
//   (récompenses + reset des compteurs) a lieu le 1er du mois suivant.

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
 * Mois en cours (YYYY-MM) — aperçu live du classement Mondial / Quartier /
 * Top clients, même format que `to_char(now(), 'YYYY-MM')` côté SQL.
 */
export const getPeriodeMois = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MOIS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/**
 * Formate une période (`YYYY-MM` mondial ou `IYYY-SWW` sous-catégorie) en
 * libellé lisible pour l'affichage (ex: certificat partageable).
 */
export const formatPeriodeLabel = (periode: string): string => {
  const mois = periode.match(/^(\d{4})-(\d{2})$/);
  if (mois) {
    const [, year, month] = mois;
    return `${MOIS_FR[parseInt(month, 10) - 1] ?? month} ${year}`;
  }
  const semaine = periode.match(/^(\d{4})-S(\d{2})$/);
  if (semaine) {
    const [, year, week] = semaine;
    return `Semaine ${week} · ${year}`;
  }
  return periode;
};
