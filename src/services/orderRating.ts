import { supabase } from '../lib/supabase';

export type RatingDirection = 'client_to_merchant' | 'merchant_to_client';

export async function uploadVocalRating(
  orderId: string,
  direction: RatingDirection,
  localUri: string,
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('non authentifié');

  const path = `${user.id}/${orderId}_${direction}.m4a`;
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('order-vocals')
    .upload(path, arrayBuffer, { contentType: 'audio/m4a', upsert: true });
  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from('order-vocals')
    .getPublicUrl(path);
  return publicUrl;
}

export async function soumettreNote(
  orderId: string,
  direction: RatingDirection,
  note: number,
  commentaire?: string,
  vocalUrl?: string,
): Promise<void> {
  const { error } = await supabase.rpc('soumettre_note_commande', {
    p_order_id: orderId,
    p_direction: direction,
    p_note: note,
    p_commentaire: commentaire ?? null,
    p_vocal_url: vocalUrl ?? null,
  });
  if (error) throw new Error(error.message);
}

export interface ClientStats {
  note_moyenne: number;
  nb_avis: number;
  points_mois: number;
}

export async function getMesStatsClient(): Promise<ClientStats> {
  const { data, error } = await supabase.rpc('get_mes_stats_client');
  if (error) throw new Error(error.message);
  return data as ClientStats;
}
