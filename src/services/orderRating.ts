import * as FileSystem from 'expo-file-system/legacy';
import { supabase, getCachedToken, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';

export type RatingDirection = 'client_to_merchant' | 'merchant_to_client';

export async function uploadVocalRating(
  orderId: string,
  direction: RatingDirection,
  localUri: string,
): Promise<string> {
  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = authData?.user ?? null;
  if (!user) throw new Error('non authentifié');

  const path = `${user.id}/${orderId}_${direction}.m4a`;

  // Lecture base64 — plus fiable que fetch() sur file:// Android
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('order-vocals')
    .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from('order-vocals')
    .getPublicUrl(path);
  return publicUrl;
}

export async function uploadVocalAvis(
  shopId: string,
  localUri: string,
): Promise<string> {
  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const user = authData?.user ?? null;
  if (!user) throw new Error('non authentifié');

  const path = `${user.id}/avis_${shopId}.m4a`;

  // Lecture base64 — plus fiable que fetch() sur file:// Android
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('order-vocals')
    .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
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
  const token = getCachedToken() ?? SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_mes_stats_client`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error('Stats client non disponibles');
  return (await res.json()) as ClientStats;
}

export interface ClientScoreRow {
  client_id: string;
  note_moyenne: number;
  nb_avis: number;
}

export async function getClientsScores(clientIds: string[]): Promise<ClientScoreRow[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_clients_scores', { p_client_ids: clientIds });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientScoreRow[];
}
