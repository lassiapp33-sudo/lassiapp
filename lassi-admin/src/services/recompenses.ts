/**
 * services/recompenses.ts — Attribution manuelle des récompenses de classement
 * (badge, certificat, priorité recherche, crédit Lassi, carrousel "Offre di
 * Quartier", Top VIP) à un prestataire ou un client.
 * Toutes les écritures passent par l'Edge Function admin-attribuer-recompense.
 */
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecompenseManuelle {
  id:                string
  prestataireId:     string | null
  clientId:          string | null
  cibleNom:          string
  cibleType:         'prestataire' | 'client'
  badge:             string | null
  certificat:        boolean
  prioriteRecherche: boolean
  creditLassi:       number
  carrouselProduits: number
  topVip:            boolean
  valideJusquA:      string | null
  estActif:          boolean
  createdAt:         string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function adminFetch(action: string, extra: object = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-attribuer-recompense`, {
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

// ─── Lecture des récompenses attribuées manuellement ─────────────────────────

export async function getRecompensesManuelles(): Promise<RecompenseManuelle[]> {
  const { data, error } = await supabase
    .from('recompenses_attribuees')
    .select('*')
    .eq('type_classement', 'manuel')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length === 0) return []

  const prestataireIds = [...new Set(rows.filter(r => r.prestataire_id).map(r => r.prestataire_id as string))]
  const clientIds      = [...new Set(rows.filter(r => r.client_id).map(r => r.client_id as string))]

  const shopsPromise = prestataireIds.length
    ? supabase.from('shops').select('merchant_id, name').in('merchant_id', prestataireIds)
    : Promise.resolve({ data: [] as { merchant_id: string; name: string }[] })

  const profilesPromise = clientIds.length
    ? supabase.from('profiles').select('id, name').in('id', clientIds)
    : Promise.resolve({ data: [] as { id: string; name: string }[] })

  const [{ data: shops }, { data: profiles }] = await Promise.all([shopsPromise, profilesPromise])

  const shopByMerchant = new Map((shops ?? []).map(s => [s.merchant_id, s.name]))
  const nameByClient   = new Map((profiles ?? []).map(p => [p.id, p.name]))

  return rows.map(r => ({
    id:                r.id,
    prestataireId:     r.prestataire_id,
    clientId:          r.client_id,
    cibleNom:          r.prestataire_id
                         ? shopByMerchant.get(r.prestataire_id) ?? '—'
                         : nameByClient.get(r.client_id ?? '') ?? '—',
    cibleType:         (r.prestataire_id ? 'prestataire' : 'client') as 'prestataire' | 'client',
    badge:             r.badge,
    certificat:        r.certificat,
    prioriteRecherche: r.priorite_recherche,
    creditLassi:       r.credit_lassi,
    carrouselProduits: r.carrousel_produits,
    topVip:            r.top_vip,
    valideJusquA:      r.valide_jusqu_a,
    estActif:          r.est_actif,
    createdAt:         r.created_at,
  }))
}

// ─── Attribution / révocation via Edge Function sécurisée ────────────────────

export interface AttribuerRecompenseParams {
  prestataireId?:     string
  clientId?:          string
  badge?:             string | null
  certificat?:        boolean
  prioriteRecherche?: boolean
  creditLassi?:       number
  carrouselProduits?: number
  topVip?:            boolean
  validUntil?:        string | null
  note?:              string | null
}

export async function attribuerRecompense(params: AttribuerRecompenseParams): Promise<void> {
  await adminFetch('attribuer', params)
}

export async function revoquerRecompense(recompenseId: string): Promise<void> {
  await adminFetch('revoquer', { recompenseId })
}
