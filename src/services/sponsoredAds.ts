import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdFormat = 'classique' | 'affiche';
export type AdStatus = 'active' | 'completed' | 'cancelled';

export interface AdPack {
  id: string;
  label: string;
  tagline: string;
  budgetCredits: number;
  durationHours: number;
  estMin: number;
  estMax: number;
  popular?: boolean;
}

export interface SponsoredAd {
  id: string;
  format: AdFormat;
  titre: string | null;
  corps: string | null;
  imageUrl: string | null;
  budgetCredits: number;
  durationHours: number;
  estMin: number;
  estMax: number;
  actualViews: number;
  contactCount: number;
  status: AdStatus;
  startedAt: string;
  expiresAt: string;
  shopId: string;
  shopName?: string;
  shopCategory?: string;
  shopLogoUrl?: string | null;
}

export interface CreateAdParams {
  shopId: string;
  format: AdFormat;
  titre?: string;
  corps?: string;
  imageUrl?: string;
  budgetCredits: number;
  durationHours: number;
  estMin: number;
  estMax: number;
}

export interface CreateAdResult {
  id: string;
  expiresAt: string;
  newBalance: number;
}

// ─── Conversion crédits ↔ FCFA ───────────────────────────────────────────────
// Taux officiel LASSI : 1 crédit = 1 FCFA (montant identique partout)

export const CREDIT_FCFA_RATE = 1;

export function creditsToFcfa(credits: number): number {
  return Math.round(credits * CREDIT_FCFA_RATE);
}

export function formatFcfa(fcfa: number): string {
  return fcfa.toLocaleString('fr-SN') + ' F';
}

// ─── Packs prédéfinis ─────────────────────────────────────────────────────────
// Tarifs et estimations calqués sur l'expérience TikTok Ads.
// Les packs offrent de meilleures conditions que le mode personnalisé.

export async function getAdPacks(): Promise<AdPack[]> {
  const { data, error } = await supabase
    .from('ad_packs')
    .select('id, label, tagline, budget_credits, duration_hours, est_min, est_max, popular')
    .eq('active', true)
    .order('budget_credits');

  if (error || !data?.length) return AD_PACKS;

  return data.map(r => ({
    id:            r.id as string,
    label:         r.label as string,
    tagline:       r.tagline as string,
    budgetCredits: r.budget_credits as number,
    durationHours: r.duration_hours as number,
    estMin:        r.est_min as number,
    estMax:        r.est_max as number,
    popular:       r.popular as boolean,
  }));
}

export const AD_PACKS: AdPack[] = [
  {
    id: 'decouverte',
    label: 'Découverte',
    tagline: 'Idéal pour tester',
    budgetCredits: 2000,
    durationHours: 12,
    estMin: 1500,
    estMax: 5000,
    popular: false,
  },
  {
    id: 'populaire',
    label: 'Populaire',
    tagline: 'Meilleur rapport portée/prix',
    budgetCredits: 5000,
    durationHours: 24,
    estMin: 5000,
    estMax: 18000,
    popular: true,
  },
  {
    id: 'boost_max',
    label: 'Boost Max',
    tagline: 'Couverture maximale',
    budgetCredits: 12000,
    durationHours: 48,
    estMin: 9000,
    estMax: 30000,
    popular: false,
  },
];

// ─── Options de durée pour le mode personnalisé ───────────────────────────────

export const DURATION_OPTIONS: { label: string; hours: number }[] = [
  { label: '6h',  hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3j',  hours: 72 },
  { label: '7j',  hours: 168 },
];

// ─── Budget personnalisé : paliers disponibles ────────────────────────────────

export const BUDGET_STEPS = [1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000];

// ─── Calcul de l'estimation de vues (mode personnalisé) ──────────────────────
// Plus conservative que les packs pour inciter à choisir un pack.

export function estimateViews(budgetCredits: number): { min: number; max: number } {
  return {
    min: Math.round(budgetCredits * 6),
    max: Math.round(budgetCredits * 18),
  };
}

// ─── Formatage durée ──────────────────────────────────────────────────────────

export function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = hours / 24;
  return days === 1 ? '1 jour' : `${days} jours`;
}

// ─── Créer une annonce (débite le crédit via RPC SECURITY DEFINER) ────────────

export async function creerAnnonceSponsorisee(
  params: CreateAdParams,
): Promise<CreateAdResult> {
  const { data, error } = await supabase.rpc('creer_annonce_sponsorisee', {
    p_shop_id:        params.shopId,
    p_format:         params.format,
    p_titre:          params.titre ?? null,
    p_corps:          params.corps ?? null,
    p_image_url:      params.imageUrl ?? null,
    p_budget_credits: params.budgetCredits,
    p_duration_hours: params.durationHours,
    p_est_min:        params.estMin,
    p_est_max:        params.estMax,
  });

  if (error) {
    const msg = error.message ?? 'Erreur de création';
    if (msg.includes('credit_insuffisant')) throw new Error('Crédit LASSI insuffisant pour lancer cette campagne.');
    if (msg.includes('unauthorized'))      throw new Error('Accès non autorisé.');
    throw new Error(msg);
  }

  const result = data as { id: string; expires_at: string; new_balance: number };
  return {
    id:         result.id,
    expiresAt:  result.expires_at,
    newBalance: result.new_balance,
  };
}

// ─── Feed client : annonces actives ──────────────────────────────────────────

interface RawAdFeed {
  id: string;
  format: string;
  titre: string | null;
  corps: string | null;
  image_url: string | null;
  estimated_views_min: number;
  estimated_views_max: number;
  actual_views: number;
  contact_count: number;
  expires_at: string;
  shop_id: string;
  shop_name: string;
  shop_category: string;
  shop_logo_url: string | null;
}

export async function getActiveSponsoredAds(limit = 5): Promise<SponsoredAd[]> {
  const { data, error } = await supabase.rpc('get_sponsored_ads_actives', { p_limit: limit });
  if (error || !data) return [];

  const rows: RawAdFeed[] = Array.isArray(data) ? data : [];
  return rows.filter(r => r.id).map(r => ({
    id:            r.id,
    format:        r.format as AdFormat,
    titre:         r.titre,
    corps:         r.corps,
    imageUrl:      r.image_url,
    budgetCredits: 0,
    durationHours: 0,
    estMin:        r.estimated_views_min,
    estMax:        r.estimated_views_max,
    actualViews:   r.actual_views,
    contactCount:  r.contact_count ?? 0,
    status:        'active',
    startedAt:     '',
    expiresAt:     r.expires_at,
    shopId:        r.shop_id,
    shopName:      r.shop_name,
    shopCategory:  r.shop_category,
    shopLogoUrl:   r.shop_logo_url,
  }));
}

// ─── Annonces du prestataire ──────────────────────────────────────────────────

export async function getMerchantAds(shopId: string): Promise<SponsoredAd[]> {
  const { data, error } = await supabase
    .from('sponsored_ads')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map(r => ({
    id:            r.id as string,
    format:        r.format as AdFormat,
    titre:         r.titre as string | null,
    corps:         r.corps as string | null,
    imageUrl:      r.image_url as string | null,
    budgetCredits: r.budget_credits as number,
    durationHours: r.duration_hours as number,
    estMin:        r.estimated_views_min as number,
    estMax:        r.estimated_views_max as number,
    actualViews:   r.actual_views as number,
    contactCount:  (r.contact_count as number) ?? 0,
    status:        r.status as AdStatus,
    startedAt:     r.started_at as string,
    expiresAt:     r.expires_at as string,
    shopId:        r.shop_id as string,
  }));
}

// ─── Tracking : vue et contact ───────────────────────────────────────────────
// Retry automatique (jusqu'à 3 tentatives) pour éviter les pertes silencieuses
// dues aux aléas réseau. Le premier appel est immédiat ; les suivants attendent
// respectivement 2 s et 5 s.

const RETRY_DELAYS_MS = [0, 2000, 5000];

async function callWithRetry(
  rpcName: string,
  params: Record<string, unknown>,
): Promise<void> {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    const { error } = await supabase.rpc(rpcName, params);
    if (!error) return;
    if (__DEV__) {
      console.warn(`[SponsoredAds] ${rpcName} tentative ${attempt + 1} échouée :`, error.message ?? error);
    }
  }
}

export function incrementerVue(adId: string): void {
  void callWithRetry('incrementer_vue_annonce', { p_ad_id: adId });
}

export function incrementerContact(adId: string): void {
  void callWithRetry('incrementer_contact_annonce', { p_ad_id: adId });
}
