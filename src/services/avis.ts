import { supabase } from '../lib/supabase';
import { Avis, AvisInput, CanLeaveAvisResult } from '../types/avis';

// ─── Mapping ─────────────────────────────────────────────────────────────────

function rowToAvis(row: Record<string, any>): Avis {
  return {
    id:                row.id,
    orderId:           row.order_id,
    shopId:            row.shop_id,
    authorId:          row.author_id,
    authorName:        row.author_name ?? '—',
    note:              Number(row.note),
    commentaire:       row.commentaire ?? null,
    photoUrl:          row.photo_url ?? null,
    reponseCommercant: row.reponse_commercant ?? null,
    masque:            Boolean(row.masque),
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export async function getShopAvis(shopId: string): Promise<Avis[]> {
  const { data, error } = await supabase
    .from('avis')
    .select('*')
    .eq('shop_id', shopId)
    .eq('masque', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAvis);
}

export async function getAvisById(avisId: string): Promise<Avis | null> {
  const { data, error } = await supabase
    .from('avis')
    .select('*')
    .eq('id', avisId)
    .single();
  if (error) return null;
  return rowToAvis(data);
}

// ─── Vérification éligibilité ─────────────────────────────────────────────────

export async function canLeaveAvis(
  shopId: string,
  userId: string,
): Promise<CanLeaveAvisResult> {
  const { data: existing } = await supabase
    .from('avis')
    .select('*')
    .eq('shop_id', shopId)
    .eq('author_id', userId)
    .maybeSingle();

  if (existing) {
    return {
      canLeave:       true,
      existingAvisId: existing.id,
      existingAvis:   rowToAvis(existing),
    };
  }

  return { canLeave: true };
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

export async function createAvis(input: AvisInput): Promise<Avis> {
  const { data, error } = await supabase
    .from('avis')
    .insert({
      order_id:    input.orderId ?? null,
      shop_id:     input.shopId,
      author_id:   input.authorId,
      author_name: input.authorName,
      note:        input.note,
      commentaire: input.commentaire ?? null,
      photo_url:   input.photoUrl   ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToAvis(data);
}

export async function updateAvis(
  avisId: string,
  changes: { note?: number; commentaire?: string | null; photoUrl?: string | null },
): Promise<void> {
  const patch: Record<string, any> = {};
  if (changes.note        !== undefined) patch.note        = changes.note;
  if (changes.commentaire !== undefined) patch.commentaire = changes.commentaire;
  if (changes.photoUrl    !== undefined) patch.photo_url   = changes.photoUrl;

  const { error } = await supabase.from('avis').update(patch).eq('id', avisId);
  if (error) throw new Error(error.message);
}

export async function deleteAvis(avisId: string): Promise<void> {
  const { error } = await supabase.from('avis').delete().eq('id', avisId);
  if (error) throw new Error(error.message);
}

export async function respondToAvis(avisId: string, reponse: string): Promise<void> {
  const { error } = await supabase
    .from('avis')
    .update({ reponse_commercant: reponse.trim() || null })
    .eq('id', avisId);
  if (error) throw new Error(error.message);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminMaskAvis(avisId: string, masque: boolean): Promise<void> {
  const { error } = await supabase.from('avis').update({ masque }).eq('id', avisId);
  if (error) throw new Error(error.message);
}

export async function adminDeleteAvis(avisId: string): Promise<void> {
  const { error } = await supabase.from('avis').delete().eq('id', avisId);
  if (error) throw new Error(error.message);
}

export async function adminGetAllAvis(opts?: {
  masque?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Avis[]> {
  let q = supabase.from('avis').select('*').order('created_at', { ascending: false });
  if (opts?.masque !== undefined) q = q.eq('masque', opts.masque);
  if (opts?.limit)  q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAvis);
}
