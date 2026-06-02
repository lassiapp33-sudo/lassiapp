/**
 * services/analytics.ts — Requêtes agrégées pour le dashboard.
 * Toutes les données viennent de Supabase en direct. Aucune donnée fictive.
 */
import { supabase } from '../lib/supabase'

export interface GtvSummary {
  gtv:          number  // Gross Transaction Value en FCFA
  commission:   number  // GTV × 0.5%
  ordersCount:  number
  shopsActive:  number
}

export interface GtvDailyPoint {
  day:          string  // ISO date 'YYYY-MM-DD'
  gtv:          number
  ordersCount:  number
}

export interface ZoneStat {
  zone:         string
  ordersCount:  number
  gtv:          number
}

// Statuts de commande considérés comme "payés"
const PAID_STATUSES = ['done', 'ready', 'preparing']

// ─── GTV + commission + stats globales ──────────────────────────────────────

export async function getGtvSummary(
  from: Date,
  to:   Date,
): Promise<GtvSummary> {
  // Commandes payées sur la période
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('total')
    .in('status', PAID_STATUSES)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())

  if (ordersErr) throw new Error(ordersErr.message)

  const gtv = (orders ?? []).reduce((acc, o) => acc + (o.total ?? 0), 0)

  // Commerces actifs (avec au moins 1 commande payée sur la période)
  const { data: activeShops, error: shopsErr } = await supabase
    .from('orders')
    .select('shop_id')
    .in('status', PAID_STATUSES)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())

  if (shopsErr) throw new Error(shopsErr.message)

  const shopsActive = new Set((activeShops ?? []).map(o => o.shop_id)).size

  return {
    gtv,
    commission:  gtv * 0.005,
    ordersCount: (orders ?? []).length,
    shopsActive,
  }
}

// ─── GTV journalier (graphe 7/30 jours) ─────────────────────────────────────

export async function getGtvDaily(days: number = 7): Promise<GtvDailyPoint[]> {
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at')
    .in('status', PAID_STATUSES)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Grouper par jour côté client
  const byDay: Record<string, { gtv: number; count: number }> = {}

  // Pré-remplir les N derniers jours avec 0 pour les jours sans commande
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    byDay[key] = { gtv: 0, count: 0 }
  }

  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10)
    if (byDay[key]) {
      byDay[key].gtv   += row.total ?? 0
      byDay[key].count += 1
    }
  }

  return Object.entries(byDay).map(([day, val]) => ({
    day,
    gtv:         val.gtv,
    ordersCount: val.count,
  }))
}

// ─── GTV par zone géographique ───────────────────────────────────────────────

export async function getGtvByZone(): Promise<ZoneStat[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('total, shops!inner(zone)')
    .in('status', PAID_STATUSES)

  if (error) throw new Error(error.message)

  const byZone: Record<string, { gtv: number; count: number }> = {}

  for (const row of data ?? []) {
    const zone = (row.shops as any)?.zone?.trim() || 'Zone inconnue'
    if (!byZone[zone]) byZone[zone] = { gtv: 0, count: 0 }
    byZone[zone].gtv   += row.total ?? 0
    byZone[zone].count += 1
  }

  return Object.entries(byZone)
    .map(([zone, val]) => ({ zone, gtv: val.gtv, ordersCount: val.count }))
    .sort((a, b) => b.gtv - a.gtv)
}

// ─── Helpers de formatage ────────────────────────────────────────────────────

export function formatFcfa(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F'
}

export function periodFrom(period: 'day' | 'week' | 'month'): Date {
  const d = new Date()
  if (period === 'day')   d.setHours(0, 0, 0, 0)
  if (period === 'week')  d.setDate(d.getDate() - 7)
  if (period === 'month') d.setDate(d.getDate() - 30)
  return d
}
