import { supabase } from '../lib/supabase';
import { StoreProduct } from '../types/store';

// ─── Mapping ─────────────────────────────────────────────────────────────────

function rowToProduct(row: Record<string, any>): StoreProduct {
  const isRealUrl = typeof row.photo_url === 'string' && row.photo_url.startsWith('http');
  // emoji column takes priority; fall back to photo_url only if it looks like an emoji (legacy)
  const emojiVal =
    row.emoji != null
      ? row.emoji
      : !isRealUrl && row.photo_url && !row.photo_url.startsWith('http')
        ? row.photo_url
        : '';
  return {
    id: row.id,
    emoji: emojiVal,
    photoUrl: isRealUrl ? row.photo_url : undefined,
    name: row.name,
    desc: row.description ?? '',
    price: row.price,
    category: row.category,
    stock: row.stock as 'in' | 'out',
    itemType: row.item_type ?? 'product',
    duration: row.duration ?? undefined,
    formulaPeriod: row.formula_period ?? undefined,
  };
}

// ─── Requêtes ────────────────────────────────────────────────────────────────

export async function getProducts(shopId: string): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToProduct);
}

export async function addProduct(
  shopId: string,
  product: Omit<StoreProduct, 'id'>,
): Promise<StoreProduct> {
  // photo_url is NOT NULL in the schema — use emoji or empty string when no real photo
  const photoUrlValue = product.photoUrl ?? product.emoji ?? '';

  const { data, error } = await supabase
    .from('products')
    .insert({
      shop_id: shopId,
      name: product.name,
      description: product.desc,
      emoji: product.emoji ?? '',
      photo_url: photoUrlValue,
      price: product.price,
      category: product.category,
      stock: product.stock,
      item_type: product.itemType ?? 'product',
      duration: product.duration ?? null,
      formula_period: product.formulaPeriod ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

export async function updateProduct(
  productId: string,
  product: Partial<Omit<StoreProduct, 'id'>>,
): Promise<void> {
  const updates: Record<string, any> = {};
  if (product.name !== undefined) updates.name = product.name;
  if (product.desc !== undefined) updates.description = product.desc;
  if (product.emoji !== undefined) updates.emoji = product.emoji;
  if (product.price !== undefined) updates.price = product.price;
  if (product.category !== undefined) updates.category = product.category;
  if (product.stock !== undefined) updates.stock = product.stock;
  if (product.itemType !== undefined) updates.item_type = product.itemType;
  if (product.duration !== undefined) updates.duration = product.duration;
  if (product.formulaPeriod !== undefined) updates.formula_period = product.formulaPeriod;

  // Keep photo_url in sync: real URL if provided, emoji or empty string otherwise (NOT NULL)
  if (product.photoUrl !== undefined || product.emoji !== undefined) {
    updates.photo_url = product.photoUrl ?? product.emoji ?? '';
  }

  const { error } = await supabase.from('products').update(updates).eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function toggleStock(productId: string, current: 'in' | 'out'): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ stock: current === 'in' ? 'out' : 'in' })
    .eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
}

// ─── Validation panier avant commande ────────────────────────────────────────
// Retourne les articles devenus indisponibles depuis l'ajout au panier.

export async function validateCartAvailability(
  shopId: string,
  itemIds: string[],
): Promise<{ id: string; name: string }[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock')
    .in('id', itemIds)
    .eq('shop_id', shopId);
  if (error) return []; // en cas d'erreur réseau, la validation serveur prendra le relais
  type CartRow = { id: string; name: string; stock: string };
  return ((data as CartRow[]) ?? [])
    .filter(p => p.stock === 'out')
    .map(p => ({ id: p.id, name: p.name }));
}
