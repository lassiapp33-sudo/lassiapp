import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase }  from '../lib/supabase';
import { computeStatus, WeekHours } from './hours';

export interface RecentShop {
  shopId:      string;
  name:        string;
  category:    string;
  logoUrl:     string | null;
  isVip:       boolean;
  rating:      number;
  isOpen:      boolean;
  statusLabel: string;
  viewedAt:    string;
}

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const cacheKey = (uid: string) => `rv_cache_${uid}`;
const queueKey = (uid: string) => `rv_queue_${uid}`;

// ─── Cache local ─────────────────────────────────────────────────────────────

async function saveCache(uid: string, shops: RecentShop[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(shops));
  } catch { /* ne bloque jamais */ }
}

async function readCache(uid: string): Promise<RecentShop[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as RecentShop[]) : [];
  } catch {
    return [];
  }
}

// ─── File d'attente hors-ligne ────────────────────────────────────────────────

interface QueueEntry { shopId: string; ts: string }

async function enqueue(uid: string, shopId: string): Promise<void> {
  try {
    const raw   = await AsyncStorage.getItem(queueKey(uid));
    const queue: QueueEntry[] = raw ? JSON.parse(raw) : [];
    const idx   = queue.findIndex(e => e.shopId === shopId);
    const entry = { shopId, ts: new Date().toISOString() };
    if (idx >= 0) queue[idx] = entry; else queue.push(entry);
    await AsyncStorage.setItem(queueKey(uid), JSON.stringify(queue));
  } catch { /* silencieux */ }
}

async function flushQueue(uid: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(uid));
    if (!raw) return;
    const queue: QueueEntry[] = JSON.parse(raw);
    if (queue.length === 0) return;

    const rows = queue.map(e => ({
      client_id: uid,
      shop_id:   e.shopId,
      viewed_at: e.ts,
    }));
    const { error } = await supabase
      .from('recently_viewed')
      .upsert(rows, { onConflict: 'client_id,shop_id' });

    if (!error) await AsyncStorage.removeItem(queueKey(uid));
  } catch { /* silencieux */ }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/** Enregistre (ou met à jour) une visite pour le client connecté. */
export async function recordView(shopId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  flushQueue(user.id).catch(() => {}); // sync hors-ligne en arrière-plan

  const { error } = await supabase
    .from('recently_viewed')
    .upsert(
      { client_id: user.id, shop_id: shopId, viewed_at: new Date().toISOString() },
      { onConflict: 'client_id,shop_id' },
    );

  if (error) await enqueue(user.id, shopId); // réseau absent → file locale
}

/** Retourne les commerces vus récemment depuis Supabase (données en direct). */
export async function getRecentlyViewed(limit = 20): Promise<RecentShop[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  await flushQueue(user.id).catch(() => {}); // synchronise d'abord les visites en attente

  const { data, error } = await supabase
    .from('recently_viewed')
    .select(`
      shop_id,
      viewed_at,
      shops(id, name, category, logo_url, is_vip, rating, opening_hours, is_manually_closed)
    `)
    .eq('client_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const shops = (data ?? []).flatMap(row => {
    const shop = (row.shops as Record<string, any> | null) ?? null;
    if (!shop || !shop.name) return []; // commerce supprimé ou désactivé → ignoré
    const status = computeStatus(
      (shop.opening_hours ?? null) as WeekHours | null,
      Boolean(shop.is_manually_closed),
    );
    return [{
      shopId:      row.shop_id,
      name:        shop.name     as string,
      category:    (shop.category ?? '') as string,
      logoUrl:     (shop.logo_url ?? null) as string | null,
      isVip:       Boolean(shop.is_vip),
      rating:      Number(shop.rating ?? 0),
      isOpen:      status.isOpen,
      statusLabel: status.label,
      viewedAt:    row.viewed_at as string,
    }];
  });

  await saveCache(user.id, shops).catch(() => {});
  return shops;
}

/** Retourne le cache local instantané (affiché avant le fetch Supabase). */
export async function getCachedRecentlyViewed(): Promise<RecentShop[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return readCache(user.id);
  } catch {
    return [];
  }
}
