import { supabase, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
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
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=*&shop_id=eq.${encodeURIComponent(shopId)}&order=created_at.asc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    return (data ?? []).map(rowToProduct);
  } catch {
    return [];
  }
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

// ─── Création en masse (Fiche Guidée) ────────────────────────────────────────

interface ProduitACreer {
  nom:         string;
  prix:        number;
  description: string;
  sousCategorie: string;
  category:    string;  // catégorie cible dans le catalogue (onglet)
  itemType:    'product' | 'service' | 'membership';
}

export async function creerProduitsEnMasse(
  shopId: string,
  produits: ProduitACreer[],
): Promise<{ success: boolean; count: number }> {
  if (produits.length === 0) return { success: true, count: 0 };

  const rows = produits.map(p => ({
    shop_id:     shopId,
    name:        p.nom,
    description: p.description,
    emoji:       '',
    photo_url:   '',
    price:       p.prix,
    category:    p.category,
    stock:       'in',
    item_type:   p.itemType,
  }));

  const { error, count } = await supabase.from('products').insert(rows);
  if (error) throw new Error(error.message);
  return { success: true, count: count ?? produits.length };
}

// ─── Validation panier avant commande ────────────────────────────────────────
// Retourne les articles devenus indisponibles depuis l'ajout au panier.

export async function getProductRawPricesByIds(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from('products').select('id, price').in('id', ids);
  const map: Record<string, number> = {};
  for (const row of (data ?? [])) map[row.id as string] = row.price as number;
  return map;
}

export async function validateCartAvailability(
  shopId: string,
  itemIds: string[],
): Promise<{ id: string; name: string }[]> {
  if (itemIds.length === 0) return [];
  try {
    // Utilise fetch direct avec clé ANON (bypass GoTrue mutex) — les produits sont publics
    const ids = itemIds.map(id => encodeURIComponent(id)).join(',');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,stock&shop_id=eq.${encodeURIComponent(shopId)}&id=in.(${ids})`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { id: string; name: string; stock: string }[];
    return data.filter(p => p.stock === 'out').map(p => ({ id: p.id, name: p.name }));
  } catch {
    return []; // en cas d'erreur réseau, la validation serveur prendra le relais
  }
}
