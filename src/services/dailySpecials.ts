import { supabase } from '../lib/supabase';

export interface DailySpecial {
  id: string;
  shopId: string;
  name: string;
  price: number;
  photoUrl: string | null;
  date: string;
}

function toRow(r: any): DailySpecial {
  return { id: r.id, shopId: r.shop_id, name: r.name, price: r.price, photoUrl: r.photo_url ?? null, date: r.date };
}

/** Tous les plats du jour actifs pour une boutique (date = aujourd'hui). */
export async function getTodaySpecials(shopId: string): Promise<DailySpecial[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_specials')
    .select('id,shop_id,name,price,photo_url,date')
    .eq('shop_id', shopId)
    .eq('date', today)
    .order('created_at', { ascending: true });
  if (error) console.warn('[dailySpecials] getTodaySpecials error:', error.message);
  return (data ?? []).map(toRow);
}

/** Ajoute un nouveau plat du jour. */
export async function addTodaySpecial(
  shopId: string,
  params: { name: string; price: number; photo_url?: string },
): Promise<DailySpecial> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_specials')
    .insert({ shop_id: shopId, name: params.name.trim(), price: params.price, date: today, photo_url: params.photo_url ?? null })
    .select('id,shop_id,name,price,photo_url,date')
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

/** Supprime un plat du jour par son id. */
export async function deleteTodaySpecialById(id: string): Promise<void> {
  const { error } = await supabase.from('daily_specials').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Compat — retourne le premier plat du jour (ShopScreen client). */
export async function getTodaySpecial(shopId: string): Promise<DailySpecial | null> {
  const list = await getTodaySpecials(shopId);
  return list[0] ?? null;
}
