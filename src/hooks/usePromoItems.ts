import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface PromoItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  photoUrl?: string;
  shopName: string;
  shopCategory: string;
  shopId: string;
}

export function usePromoItems(): { items: PromoItem[]; loading: boolean } {
  const [raw, setRaw] = useState<PromoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ① Commerces avec une "Offre du quartier" effective (don admin ou abonnement payé)
        const { data: shops } = await supabase
          .from('shops_effective')
          .select('id, name, category, featured_product_id, featured_product_ids, featured_all_products')
          .eq('is_effectively_featured', true);

        type ShopRow = {
          id: string;
          name: string;
          category: string;
          featured_product_id: string | null;
          featured_product_ids: string[] | null;
          featured_all_products: boolean;
        };
        const shopRows = (shops ?? []) as ShopRow[];

        const allProductsShops = shopRows.filter(s => s.featured_all_products);
        const specificShops = shopRows.filter(s => !s.featured_all_products);

        // ② Produits annoncés individuellement (1, plusieurs, ou abonnement payé)
        const shopByProductId = new Map<string, ShopRow>();
        for (const s of specificShops) {
          const ids = s.featured_product_ids?.length
            ? s.featured_product_ids
            : s.featured_product_id
              ? [s.featured_product_id]
              : [];
          for (const id of ids) shopByProductId.set(id, s);
        }
        const specificIds = Array.from(shopByProductId.keys());

        if (specificIds.length === 0 && allProductsShops.length === 0) {
          if (!cancelled) {
            setRaw([]);
            setLoading(false);
          }
          return;
        }

        const [specificRes, allProductsRes] = await Promise.all([
          specificIds.length > 0
            ? supabase
                .from('products')
                .select('id, name, price, emoji, photo_url, stock, shop_id')
                .in('id', specificIds)
                .eq('stock', 'in')
            : Promise.resolve({ data: [] as any[] }),
          allProductsShops.length > 0
            ? supabase
                .from('products')
                .select('id, name, price, emoji, photo_url, stock, shop_id')
                .in('shop_id', allProductsShops.map(s => s.id))
                .eq('stock', 'in')
            : Promise.resolve({ data: [] as any[] }),
        ]);

        if (cancelled) return;

        const shopById = new Map(allProductsShops.map(s => [s.id, s]));

        const toItem = (row: any, shop: ShopRow): PromoItem => ({
          id: row.id,
          name: row.name,
          price: row.price as number,
          emoji: row.emoji ?? '',
          photoUrl:
            typeof row.photo_url === 'string' && row.photo_url.startsWith('http')
              ? row.photo_url
              : undefined,
          shopName: shop.name,
          shopCategory: shop.category,
          shopId: shop.id,
        });

        const items: PromoItem[] = [
          ...(specificRes.data ?? [])
            .filter((row: any) => shopByProductId.has(row.id))
            .map((row: any) => toItem(row, shopByProductId.get(row.id)!)),
          ...(allProductsRes.data ?? [])
            .filter((row: any) => shopById.has(row.shop_id))
            .map((row: any) => toItem(row, shopById.get(row.shop_id)!)),
        ];

        setRaw(items);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Mélange aléatoire stabilisé au montage (ne re-shuffle pas sur re-render)
  const items = useMemo(() => [...raw].sort(() => Math.random() - 0.5), [raw]);

  return { items, loading };
}
