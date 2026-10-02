/**
 * services/signalements.ts — Lecture et gestion des signalements côté admin.
 */
import { supabase } from '../lib/supabase'

export type SignalementStatus = 'nouveau' | 'en_cours' | 'resolu'
export type SignalementType   =
  | 'bug' | 'paiement' | 'commande' | 'commerce' | 'arnaque' | 'autre'

export interface Signalement {
  id:             string
  userId:         string | null
  userName:       string | null
  profil:         'client' | 'prestataire'
  type:           SignalementType
  description:    string
  relatedOrderId: string | null
  relatedShopId:  string | null
  shopName:       string | null
  screenshotUrl:  string | null
  status:         SignalementStatus
  createdAt:      string
}

export const TYPE_LABELS: Record<SignalementType, string> = {
  bug:      "Bug / l'app ne marche pas",
  paiement: 'Problème de paiement',
  commande: 'Problème avec une commande',
  commerce: 'Problème avec un commerçant / client',
  arnaque:  'Contenu inapproprié / arnaque',
  autre:    'Autre',
}

export const STATUS_LABELS: Record<SignalementStatus, string> = {
  nouveau:  'Nouveau',
  en_cours: 'En cours',
  resolu:   'Résolu',
}

export const STATUS_COLORS: Record<SignalementStatus, string> = {
  nouveau:  'bg-danger/20 text-danger',
  en_cours: 'bg-orange/20 text-orange',
  resolu:   'bg-success/20 text-success',
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export async function getSignalements(
  status?: SignalementStatus | 'all',
  type?:   SignalementType   | 'all',
): Promise<Signalement[]> {
  // user_id → auth.users (pas profiles), donc pas de join direct possible via PostgREST
  let q = supabase
    .from('signalements')
    .select(`
      id, user_id, profil, type, description,
      related_order_id, related_shop_id,
      screenshot_url, status, created_at,
      shops!related_shop_id(name)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') q = q.eq('status', status)
  if (type   && type   !== 'all') q = q.eq('type',   type)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = data ?? []

  // Récupération des noms en une seule requête batch
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))]
  let nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    if (profiles) {
      nameMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.name]))
    }
  }

  return rows.map((row: any) => ({
    id:             row.id,
    userId:         row.user_id,
    userName:       nameMap[row.user_id] ?? null,
    profil:         row.profil,
    type:           row.type,
    description:    row.description,
    relatedOrderId: row.related_order_id,
    relatedShopId:  row.related_shop_id,
    shopName:       row.shops?.name ?? null,
    screenshotUrl:  row.screenshot_url,
    status:         row.status,
    createdAt:      row.created_at,
  }))
}

export async function getNewSignalementsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('signalements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'nouveau')

  if (error) return 0
  return count ?? 0
}

// ─── Signed URL pour les captures (bucket privé) ─────────────────────────────
// Génère une URL temporaire valable 1 heure pour afficher la capture dans l'admin.

export async function getSignedScreenshotUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('signalements')
    .createSignedUrl(path, 3_600) // expire après 1h

  if (error || !data) return null
  return data.signedUrl
}

// ─── Mise à jour statut ───────────────────────────────────────────────────────

export async function updateSignalementStatus(
  id:     string,
  status: SignalementStatus,
): Promise<void> {
  const { error } = await supabase
    .from('signalements')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
