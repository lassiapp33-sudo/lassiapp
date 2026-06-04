import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';

export async function getFavoriteIds(): Promise<string[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];
  const { data, error } = await supabase.from('favorites').select('shop_id').eq('user_id', userId);
  if (error) return [];
  return (data ?? []).map(r => r.shop_id as string);
}

export async function addFavorite(shopId: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await supabase.from('favorites').insert({ user_id: userId, shop_id: shopId });
}

export async function removeFavorite(shopId: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await supabase.from('favorites').delete().eq('user_id', userId).eq('shop_id', shopId);
}

export async function toggleFavorite(shopId: string, isFav: boolean): Promise<void> {
  if (isFav) {
    await removeFavorite(shopId);
  } else {
    await addFavorite(shopId);
  }
}
