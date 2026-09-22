/**
 * services/stories.ts — « Ça bouge » : stories quotidiennes prestataire ⇄ client.
 *
 * Backend : migration 20260919000000_ca_bouge_stories.sql (RPC SECURITY DEFINER).
 * Médias : bucket Storage 'stories' via Edge Function upload-image.
 */
import { supabase } from '../lib/supabase';
import { uploadImage, storyImagePath } from './storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReactionType = 'like' | 'fire' | 'dispo';

export interface Story {
  id: string;
  mediaUrl: string;
  caption: string | null;
  price: number | null;
  stock: number | null;
  viewsCount: number;
  reactionsCount: number;
  createdAt: string;
  expiresAt: string;
  viewerViewed?: boolean;
  viewerReaction?: ReactionType | null;
}

export interface ShopStories {
  shopId: string;
  shopName: string;
  shopLogoUrl: string | null;
  isVip: boolean;
  streak: number;
  hasUnseen: boolean;
  stories: Story[];
}

export interface StoryComment {
  id: string;
  text: string;
  intentDetected: boolean;
  createdAt: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
}

export interface MyStoriesResult {
  stories: Story[];
  streak: number;
  quota: number;
  quotaLeft: number;
}

// ─── Mapping brut → typé ──────────────────────────────────────────────────────

function mapStory(r: Record<string, unknown>): Story {
  return {
    id:             r.id as string,
    mediaUrl:       r.media_url as string,
    caption:        (r.caption as string | null) ?? null,
    price:          r.price != null ? Number(r.price) : null,
    stock:          r.stock != null ? Number(r.stock) : null,
    viewsCount:     (r.views_count as number) ?? 0,
    reactionsCount: (r.reactions_count as number) ?? 0,
    createdAt:      r.created_at as string,
    expiresAt:      r.expires_at as string,
    viewerViewed:   (r.viewer_viewed as boolean) ?? false,
    viewerReaction: (r.viewer_reaction as ReactionType | null) ?? null,
  };
}

// ─── Feed client : stories actives groupées par boutique (rings) ──────────────

export async function getStoriesFeed(): Promise<ShopStories[]> {
  const { data, error } = await supabase.rpc('get_stories_feed');
  if (error || !data) return [];
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  return rows.map(g => ({
    shopId:      g.shop_id as string,
    shopName:    g.shop_name as string,
    shopLogoUrl: (g.shop_logo_url as string | null) ?? null,
    isVip:       (g.is_vip as boolean) ?? false,
    streak:      (g.story_streak as number) ?? 0,
    hasUnseen:   (g.has_unseen as boolean) ?? false,
    stories:     ((g.stories as Record<string, unknown>[]) ?? []).map(mapStory),
  }));
}

// ─── Poster une story (prestataire) ───────────────────────────────────────────

export async function postStory(params: {
  shopId: string;
  localUri: string;
  caption?: string;
  price?: number | null;
  stock?: number | null;
}): Promise<{ id: string; expiresAt: string; streak: number; quotaLeft: number }> {
  const url = await uploadImage('stories', params.localUri, storyImagePath(params.shopId));

  const { data, error } = await supabase.rpc('post_story', {
    p_shop_id:   params.shopId,
    p_media_url: url,
    p_caption:   params.caption ?? null,
    p_price:     params.price ?? null,
    p_stock:     params.stock ?? null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('quota_atteint')) throw new Error('Quota de stories du jour atteint. Reviens demain !');
    if (msg.includes('non_autorise'))  throw new Error('Action non autorisée.');
    throw new Error('Échec de publication de la story.');
  }

  const r = data as { id: string; expires_at: string; streak: number; quota_left: number };
  return { id: r.id, expiresAt: r.expires_at, streak: r.streak, quotaLeft: r.quota_left };
}

// ─── Mes stories (prestataire) ────────────────────────────────────────────────

export async function getMyStories(shopId: string): Promise<MyStoriesResult> {
  const { data, error } = await supabase.rpc('get_my_stories', { p_shop_id: shopId });
  if (error || !data) return { stories: [], streak: 0, quota: 3, quotaLeft: 3 };
  const r = data as Record<string, unknown>;
  return {
    stories:   ((r.stories as Record<string, unknown>[]) ?? []).map(mapStory),
    streak:    (r.streak as number) ?? 0,
    quota:     (r.quota as number) ?? 3,
    quotaLeft: (r.quota_left as number) ?? 3,
  };
}

export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_story', { p_id: id });
  if (error) throw new Error('Suppression impossible.');
}

// ─── Vue (fire-and-forget) ────────────────────────────────────────────────────

export function recordStoryView(storyId: string): void {
  void supabase.rpc('record_story_view', { p_story_id: storyId });
}

// ─── Réactions ────────────────────────────────────────────────────────────────

export async function reactToStory(storyId: string, type: ReactionType): Promise<void> {
  await supabase.rpc('react_to_story', { p_story_id: storyId, p_type: type });
}

export async function unreactStory(storyId: string): Promise<void> {
  await supabase.rpc('unreact_story', { p_story_id: storyId });
}

// ─── Commentaires ─────────────────────────────────────────────────────────────

export async function commentStory(
  storyId: string,
  text: string,
  replyToUser?: string | null,
): Promise<StoryComment & { shopId: string; shopName: string }> {
  const { data, error } = await supabase.rpc('comment_story', {
    p_story_id: storyId,
    p_text: text,
    p_reply_to_user: replyToUser ?? null,
  });
  if (error || !data) throw new Error('Commentaire non envoyé.');
  const r = data as Record<string, unknown>;
  return {
    id:             r.id as string,
    text:           r.text as string,
    intentDetected: (r.intent_detected as boolean) ?? false,
    createdAt:      r.created_at as string,
    userId:         (r.user_id as string) ?? '',
    userName:       (r.user_name as string) ?? 'Client',
    userAvatar:     null,
    shopId:         r.shop_id as string,
    shopName:       (r.shop_name as string) ?? '',
  };
}

export async function getStoryComments(storyId: string): Promise<StoryComment[]> {
  const { data, error } = await supabase.rpc('get_story_comments', { p_story_id: storyId });
  if (error || !data) return [];
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  return rows.map(r => ({
    id:             r.id as string,
    text:           r.text as string,
    intentDetected: (r.intent_detected as boolean) ?? false,
    createdAt:      r.created_at as string,
    userId:         (r.user_id as string) ?? '',
    userName:       (r.user_name as string) ?? 'Client',
    userAvatar:     (r.user_avatar as string | null) ?? null,
  }));
}
