/**
 * services/disputes.ts — Gestion des litiges (lecture + arbitrage admin).
 * Les actions admin (changement de statut, résolution) passent par une Edge Function.
 */
import { supabase } from '../lib/supabase'

export type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
export type DisputeReason =
  | 'paid_not_received'
  | 'wrong_product'
  | 'payment_issue'
  | 'debt_disagreement'
  | 'no_response'
  | 'other'

export interface Dispute {
  id:           string
  reporterName: string
  reporterRole: 'client' | 'merchant'
  againstName:  string
  shopName:     string | null
  type:         'order' | 'debt'
  orderId:      string | null
  debtId:       string | null
  reason:       DisputeReason
  description:  string
  evidenceUrls: string[]
  status:       DisputeStatus
  resolution:   string | null
  resolvedAt:   string | null
  createdAt:    string
}

export interface DisputeMessage {
  id:            string
  senderName:    string
  senderRole:    'client' | 'merchant' | 'admin'
  message:       string
  attachmentUrl: string | null
  createdAt:     string
}

// Libellés français des motifs
export const REASON_LABELS: Record<DisputeReason, string> = {
  paid_not_received: 'Payé mais rien reçu',
  wrong_product:     'Produit non conforme',
  payment_issue:     'Problème de paiement',
  debt_disagreement: 'Désaccord sur dette',
  no_response:       'Commerçant ne répond pas',
  other:             'Autre',
}

export const STATUS_LABELS: Record<DisputeStatus, string> = {
  open:      'Ouvert',
  in_review: 'En examen',
  resolved:  'Résolu',
  rejected:  'Rejeté',
}

// ─── Lecture des litiges ─────────────────────────────────────────────────────

export async function getDisputes(
  status?: DisputeStatus | 'all'
): Promise<Dispute[]> {
  let query = supabase
    .from('disputes')
    .select(`
      id, reporter_role, type, order_id, debt_id,
      reason, description, evidence_urls, status,
      resolution, resolved_at, created_at,
      reporter:profiles!reporter_id(name),
      against:profiles!against_id(name),
      shops(name)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(rowToDispute)
}

export async function getDisputeById(id: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select(`
      id, reporter_role, type, order_id, debt_id,
      reason, description, evidence_urls, status,
      resolution, resolved_at, created_at,
      reporter:profiles!reporter_id(name),
      against:profiles!against_id(name),
      shops(name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToDispute(data)
}

function rowToDispute(row: any): Dispute {
  return {
    id:           row.id,
    reporterName: row.reporter?.name ?? 'Inconnu',
    reporterRole: row.reporter_role,
    againstName:  row.against?.name ?? 'Inconnu',
    shopName:     row.shops?.name ?? null,
    type:         row.type,
    orderId:      row.order_id,
    debtId:       row.debt_id,
    reason:       row.reason,
    description:  row.description,
    evidenceUrls: (row.evidence_urls ?? []) as string[],
    status:       row.status,
    resolution:   row.resolution,
    resolvedAt:   row.resolved_at,
    createdAt:    row.created_at,
  }
}

// ─── Messages du fil de discussion ──────────────────────────────────────────

export async function getDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
  const { data, error } = await supabase
    .from('dispute_messages')
    .select('id, sender_role, message, attachment_url, created_at, profiles!sender_id(name)')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:            row.id,
    senderName:    (row.profiles as any)?.name ?? 'Inconnu',
    senderRole:    row.sender_role,
    message:       row.message,
    attachmentUrl: row.attachment_url,
    createdAt:     row.created_at,
  }))
}

// ─── Actions admin (via Edge Function) ───────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface ResolveParams {
  disputeId:  string
  status:     DisputeStatus
  resolution: string
  message?:   string   // message visible aux parties
}

export async function resolveDispute(params: ResolveParams): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-resolve-dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${session.access_token}`,
      apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(params),
  })

  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Erreur lors de l\'arbitrage')
}

// Ajouter un message admin dans le fil
export async function addAdminMessage(disputeId: string, message: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const { error } = await supabase.from('dispute_messages').insert({
    dispute_id:  disputeId,
    sender_id:   session.user.id,
    sender_role: 'admin',
    message,
  })

  if (error) throw new Error(error.message)
}

// ─── Compteur de litiges ouverts (badge sidebar) ─────────────────────────────

export async function getOpenDisputesCount(): Promise<number> {
  const { count, error } = await supabase
    .from('disputes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  if (error) return 0
  return count ?? 0
}

// ─── Stats récidivistes ──────────────────────────────────────────────────────

export interface RecidivistStat {
  shopId:        string | null
  shopName:      string | null
  disputesCount: number
  resolvedAgainst: number   // litiges perdus par le commerce
}

export async function getShopDisputeStats(): Promise<RecidivistStat[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select('shop_id, status, shops(name)')
    .not('shop_id', 'is', null)

  if (error) throw new Error(error.message)

  const byShop: Record<string, RecidivistStat> = {}

  for (const row of data ?? []) {
    const id = row.shop_id!
    if (!byShop[id]) {
      byShop[id] = {
        shopId:          id,
        shopName:        (row.shops as any)?.name ?? null,
        disputesCount:   0,
        resolvedAgainst: 0,
      }
    }
    byShop[id].disputesCount++
    if (row.status === 'resolved') byShop[id].resolvedAgainst++
  }

  return Object.values(byShop).sort((a, b) => b.disputesCount - a.disputesCount)
}
