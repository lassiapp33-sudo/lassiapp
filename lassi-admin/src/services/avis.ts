/**
 * services/avis.ts — Lecture et modération des avis côté admin.
 */
import { supabase } from '../lib/supabase'

export interface AvisAdmin {
  id:                string
  orderId:           string
  shopId:            string
  shopName:          string
  authorId:          string
  authorName:        string
  note:              number
  commentaire:       string | null
  photoUrl:          string | null
  reponseCommercant: string | null
  masque:            boolean
  createdAt:         string
}

function rowToAvis(row: Record<string, any>): AvisAdmin {
  const shop = (row.shops as Record<string, any> | null) ?? {}
  return {
    id:                row.id,
    orderId:           row.order_id,
    shopId:            row.shop_id,
    shopName:          shop.name ?? '—',
    authorId:          row.author_id,
    authorName:        row.author_name ?? '—',
    note:              Number(row.note),
    commentaire:       row.commentaire ?? null,
    photoUrl:          row.photo_url ?? null,
    reponseCommercant: row.reponse_commercant ?? null,
    masque:            Boolean(row.masque),
    createdAt:         row.created_at,
  }
}

export async function getAllAvis(opts?: {
  masqueOnly?: boolean
  limit?: number
  offset?: number
}): Promise<AvisAdmin[]> {
  let q = supabase
    .from('avis')
    .select('*, shops(name)')
    .order('created_at', { ascending: false })

  if (opts?.masqueOnly) q = q.eq('masque', true)
  if (opts?.limit)      q = q.limit(opts.limit)
  if (opts?.offset)     q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAvis)
}

export async function getMaskedAvisCount(): Promise<number> {
  const { count, error } = await supabase
    .from('avis')
    .select('*', { count: 'exact', head: true })
    .eq('masque', false)
  if (error) return 0
  return count ?? 0
}

export async function maskAvis(avisId: string, masque: boolean): Promise<void> {
  const { error } = await supabase.from('avis').update({ masque }).eq('id', avisId)
  if (error) throw new Error(error.message)
}

export async function deleteAvis(avisId: string): Promise<void> {
  const { error } = await supabase.from('avis').delete().eq('id', avisId)
  if (error) throw new Error(error.message)
}
