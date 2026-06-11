import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import * as Location from 'expo-location';
import { reverseGeocode } from './location';
import type { WeekHours } from './hours';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Shop {
  id: string;
  merchantId: string | null;
  name: string;
  subtitle: string;
  description: string | null;
  category: string;
  subcategories: string[];
  shopType: 'products' | 'services' | 'memberships' | 'terrains';
  zone: string;
  addressText: string | null;
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean;
  isManuallyClose: boolean;
  openingHours: WeekHours | null;
  galleryUrls: string[];
  isVip: boolean;
  vipRank: number | null; // 1, 2, 3 dans le podium — null si pas VIP
  rating: number;
  reviewsCount: number;
  ordersCount: number;
  interactionsCount: number;
  createdAt: string; // ISO — utilisé pour le badge "Nouveau" (< 4 mois)
  phone: string | null;
  logoUrl: string | null;
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function rowToShop(row: Record<string, any>): Shop {
  const now = new Date();
  const isExclu = row.vip_exclu === true;
  const isVipManual =
    !isExclu &&
    row.vip_manual === true &&
    (row.vip_manual_until == null || new Date(row.vip_manual_until) > now);
  return {
    id: row.id,
    merchantId: row.merchant_id ?? null,
    name: row.name,
    subtitle: row.subtitle ?? '',
    description: row.description ?? null,
    category: row.category,
    subcategories: Array.isArray(row.subcategories) ? row.subcategories : [],
    shopType: row.shop_type ?? 'products',
    zone: row.zone ?? '',
    addressText: row.address_text ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    isOpen: row.is_open,
    isManuallyClose: Boolean(row.is_manually_closed),
    openingHours: row.opening_hours ?? null,
    galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
    isVip: !isExclu && (Boolean(row.is_vip) || isVipManual),
    vipRank: isExclu ? null : (row.vip_rank ?? null),
    rating: Number(row.rating ?? 0),
    reviewsCount: Number(row.reviews_count ?? 0),
    ordersCount: Number(row.orders_count ?? 0),
    interactionsCount: Number(row.interactions_count ?? 0),
    createdAt: row.created_at ?? new Date().toISOString(),
    phone: row.phone ?? null,
    logoUrl: row.logo_url ?? null,
  };
}

// ─── Distance GPS (Haversine) ─────────────────────────────────────────────────

/** Retourne la distance en mètres entre deux coordonnées GPS. */
export function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formate une distance en mètres en texte lisible + estimation à pied (~12 min/km). */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  const distStr = meters < 1000 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
  const mins = Math.max(1, Math.round(km * 12));
  return `${distStr} · ~${mins} min à pied`;
}

export function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const d = calcDistanceMeters(lat1, lng1, lat2, lng2);
  return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
}

export async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

// ─── Requêtes ────────────────────────────────────────────────────────────────

export async function getShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('rating', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToShop);
}

export async function getShopsByCategory(category: string): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('category', category)
    .order('rating', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToShop);
}

export async function getShopById(id: string): Promise<Shop | null> {
  const { data, error } = await supabase.from('shops').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToShop(data);
}

// ─── Marchand : ma boutique ───────────────────────────────────────────────────

export async function getMyShop(): Promise<Shop | null> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('merchant_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToShop(data) : null;
}

export interface UpsertShopParams {
  name: string;
  subtitle: string;
  category: string;
  subcategories?: string[];
  shopType?: 'products' | 'services' | 'memberships' | 'terrains';
  description?: string;
  addressText?: string;
  zone: string;
  isOpen: boolean;
  phone?: string;
  openingHours?: WeekHours | null;
  isManuallyClose?: boolean;
}

export async function upsertMyShop(params: UpsertShopParams): Promise<Shop> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Non connecté');

  // Check if shop already exists for this merchant
  const existing = await getMyShop();

  if (existing) {
    const { data, error } = await supabase
      .from('shops')
      .update({
        name: params.name,
        subtitle: params.subtitle,
        category: params.category,
        subcategories: params.subcategories ?? existing.subcategories,
        shop_type: params.shopType ?? existing.shopType,
        description: params.description ?? existing.description,
        address_text: params.addressText ?? existing.addressText,
        zone: params.zone,
        is_open: params.isOpen,
        phone: params.phone ?? existing.phone,
        opening_hours:
          params.openingHours !== undefined ? params.openingHours : existing.openingHours,
        is_manually_closed:
          params.isManuallyClose !== undefined ? params.isManuallyClose : existing.isManuallyClose,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToShop(data);
  } else {
    const { data, error } = await supabase
      .from('shops')
      .insert({
        merchant_id: userId,
        name: params.name,
        subtitle: params.subtitle,
        category: params.category,
        subcategories: params.subcategories ?? [],
        shop_type: params.shopType ?? 'products',
        description: params.description ?? null,
        address_text: params.addressText ?? null,
        zone: params.zone,
        is_open: params.isOpen,
        phone: params.phone ?? null,
        opening_hours: params.openingHours ?? null,
        is_manually_closed: params.isManuallyClose ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToShop(data);
  }
}

export async function updateShopStatus(shopId: string, isOpen: boolean): Promise<void> {
  const { error } = await supabase.from('shops').update({ is_open: isOpen }).eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function updateOpeningHours(shopId: string, hours: WeekHours | null): Promise<void> {
  const { error } = await supabase.from('shops').update({ opening_hours: hours }).eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function updateManuallyClose(shopId: string, closed: boolean): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update({ is_manually_closed: closed, is_open: !closed })
    .eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function updateShopDetails(
  shopId: string,
  updates: { description?: string; addressText?: string; phone?: string },
): Promise<void> {
  const patch: Record<string, any> = {};
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.addressText !== undefined) patch.address_text = updates.addressText;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  const { error } = await supabase.from('shops').update(patch).eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function updateGalleryUrls(shopId: string, urls: string[]): Promise<void> {
  const { error } = await supabase.from('shops').update({ gallery_urls: urls }).eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function updateShopLogo(shopId: string, logoUrl: string): Promise<void> {
  const { error } = await supabase.from('shops').update({ logo_url: logoUrl }).eq('id', shopId);
  if (error) throw new Error(error.message);
}

/** Enregistre la position GPS d'un commerce dans Supabase */
export async function updateShopLocation(shopId: string, lat: number, lng: number): Promise<void> {
  const zone = await reverseGeocode(lat, lng);
  const { error } = await supabase
    .from('shops')
    .update({ latitude: lat, longitude: lng, ...(zone ? { zone } : {}) })
    .eq('id', shopId);
  if (error) throw new Error(error.message);
}

/** Charge les commerces dont les coordonnées sont dans la bounding box */
export async function getShopsInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLng)
    .lte('longitude', maxLng);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToShop);
}
