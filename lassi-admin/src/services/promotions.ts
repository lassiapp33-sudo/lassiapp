/**
 * services/promotions.ts — Gestion des mises en avant manuelles (VIP + Reco) + scoring.
 * Toutes les écritures passent par des Edge Functions sécurisées.
 */
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShopWithPromo {
  id:                   string
  name:                 string
  category:             string
  zone:                 string
  logoUrl:              string | null
  isVip:                boolean
  vipManual:            boolean
  vipManualUntil:       string | null
  vipExclu:             boolean
  featuredManual:       boolean
  featuredManualUntil:  string | null
  manualNote:           string | null
  ordersCount?:         number
  rating:               number
}

export interface VipScoreShop {
  id:          string
  name:        string
  category:    string
  zone:        string
  logoUrl:     string | null
  isVip:       boolean
  vipManual:   boolean
  vipExclu:    boolean
  rating:      number
  ordersCount: number
  score:       number
}

export interface VipSettings {
  id:                  number
  poids_commandes:     number
  poids_ca:            number
  poids_note:          number
  cap_ca_par_commande: number
  plafond_par_client:  number
  taille_podium:       number
  updated_by:          string | null
  updated_at:          string
}

export interface VipRanking {
  semaine:    string
  rang:       number
  score:      number
  source:     'auto' | 'manuel'
  categorie:  string
  created_at: string
  shops: {
    id:       string
    name:     string
    zone:     string
    logo_url: string | null
    category: string
  }
}

export interface VipRunLog {
  id:       string
  semaine:  string
  run_at:   string
  statut:   'ok' | 'erreur' | 'doublon'
  details:  string | null
  run_by:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function adminFetch(action: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-vip-control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${session.access_token}`,
      apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...extra }),
  })

  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Erreur lors de la requête')
  return body
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function getAllShopsWithPromo(): Promise<ShopWithPromo[]> {
  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, name, category, zone, logo_url, is_vip, rating,
      vip_manual, vip_manual_until, vip_exclu,
      featured_manual, featured_manual_until,
      manual_note
    `)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToShopPromo)
}

function rowToShopPromo(row: any): ShopWithPromo {
  return {
    id:                  row.id,
    name:                row.name,
    category:            row.category,
    zone:                row.zone ?? '',
    logoUrl:             row.logo_url,
    isVip:               row.is_vip,
    vipManual:           row.vip_manual,
    vipManualUntil:      row.vip_manual_until,
    vipExclu:            row.vip_exclu ?? false,
    featuredManual:      row.featured_manual,
    featuredManualUntil: row.featured_manual_until,
    manualNote:          row.manual_note,
    rating:              Number(row.rating),
  }
}

// ─── Mise à jour via Edge Function sécurisée ─────────────────────────────────

interface SetFeaturedParams {
  shopId:         string
  vipManual?:     boolean
  vipUntil?:      string | null
  vipExclu?:      boolean
  featuredManual?: boolean
  featuredUntil?: string | null
  note?:          string | null
}

export async function setShopFeatured(params: SetFeaturedParams): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-set-featured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${session.access_token}`,
      apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      shopId:         params.shopId,
      vipManual:      params.vipManual,
      vipUntil:       params.vipUntil,
      vipExclu:       params.vipExclu,
      featuredManual: params.featuredManual,
      featuredUntil:  params.featuredUntil,
      note:           params.note,
    }),
  })

  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Erreur lors de la mise à jour')
}

// ─── Scoring VIP (admin display — 7 derniers jours, données réelles) ─────────

export async function getVipScores(): Promise<VipScoreShop[]> {
  const { data: shops, error: sErr } = await supabase
    .from('shops')
    .select('id, name, category, zone, logo_url, is_vip, vip_manual, vip_exclu, rating, reviews_count')

  if (sErr) throw new Error(sErr.message)

  const from7 = new Date()
  from7.setDate(from7.getDate() - 7)

  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('shop_id')
    .eq('status', 'done')
    .in('pay_method', ['wave', 'om'])
    .gte('created_at', from7.toISOString())

  if (oErr) throw new Error(oErr.message)

  const countByShop: Record<string, number> = {}
  for (const o of orders ?? []) {
    countByShop[o.shop_id] = (countByShop[o.shop_id] ?? 0) + 1
  }

  return (shops ?? [])
    .map(s => {
      const orders = countByShop[s.id] ?? 0
      const reviewsCount = Number(s.reviews_count) || 0
      const ratingWeighted = Number(s.rating) * Math.sqrt(reviewsCount + 1)
      return {
        id:          s.id,
        name:        s.name,
        category:    s.category,
        zone:        s.zone ?? '',
        logoUrl:     s.logo_url,
        isVip:       s.is_vip,
        vipManual:   s.vip_manual,
        vipExclu:    s.vip_exclu ?? false,
        rating:      Number(s.rating),
        ordersCount: orders,
        score:       orders * 0.6 + ratingWeighted * 0.2,
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ─── Récap des mises en avant actives ────────────────────────────────────────

export async function getActiveManualPromos(): Promise<{
  vipCount:      number
  featuredCount: number
  shops:         ShopWithPromo[]
}> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, name, category, zone, logo_url, is_vip, rating,
      vip_manual, vip_manual_until, vip_exclu,
      featured_manual, featured_manual_until,
      manual_note
    `)
    .or(
      `and(vip_manual.eq.true,or(vip_manual_until.is.null,vip_manual_until.gt.${now})),` +
      `and(featured_manual.eq.true,or(featured_manual_until.is.null,featured_manual_until.gt.${now}))`
    )
    .order('name')

  if (error) throw new Error(error.message)

  const shops = (data ?? []).map(rowToShopPromo)

  return {
    vipCount:      shops.filter(s => s.vipManual).length,
    featuredCount: shops.filter(s => s.featuredManual).length,
    shops,
  }
}

// ─── Historique des classements ───────────────────────────────────────────────

export async function getVipHistory(semaine?: string): Promise<VipRanking[]> {
  const result = await adminFetch('get_history', semaine ? { semaine } : {})
  return result.rankings ?? []
}

// ─── Journal des exécutions ───────────────────────────────────────────────────

export async function getVipRunLog(): Promise<VipRunLog[]> {
  const result = await adminFetch('get_run_log')
  return result.logs ?? []
}

// ─── Config vip_settings ──────────────────────────────────────────────────────

export async function getVipSettings(): Promise<VipSettings> {
  const result = await adminFetch('get_settings')
  return result.settings
}

export async function updateVipSettings(settings: Partial<Omit<VipSettings, 'id' | 'updated_by' | 'updated_at'>>): Promise<void> {
  await adminFetch('set_settings', { settings })
}

// ─── Recalculer le classement ─────────────────────────────────────────────────

export async function recalculateVip(): Promise<{ ok: boolean; result: any }> {
  return adminFetch('recalculate')
}

// ─── Exclure / réintégrer ─────────────────────────────────────────────────────

export async function setVipExclu(shopId: string, exclu: boolean, raison?: string): Promise<void> {
  await adminFetch('set_exclu', { shopId, exclu, raison })
}

// ─── Semaine ISO courante ─────────────────────────────────────────────────────

export function getCurrentISOWeek(): string {
  const now = new Date()
  const tmp = new Date(now.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7)
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const week = 1 + Math.round(
    ((tmp.getTime() - week1.getTime()) / 86400000
      - 3 + (week1.getDay() + 6) % 7) / 7,
  )
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`
}
