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
          .select('id, name, category, featured_product_id')
          .eq('is_effectively_featured', true)
          .not('featured_product_id', 'is', null);

        const shopRows = (shops ?? []) as {
          id: string;
          name: string;
          category: string;
          featured_product_id: string;
        }[];

        if (shopRows.length === 0) {
          if (!cancelled) {
            setRaw([]);
            setLoading(false);
          }
          return;
        }

        // ② Produits annoncés (en stock uniquement)
        const productIds = shopRows.map(s => s.featured_product_id);
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price, emoji, photo_url, stock')
          .in('id', productIds)
          .eq('stock', 'in');

        if (cancelled) return;

        const shopById = new Map(shopRows.map(s => [s.featured_product_id, s]));

        const items: PromoItem[] = (products ?? []).map((row: any) => {
          const shop = shopById.get(row.id);
          return {
            id: row.id,
            name: row.name,
            price: row.price as number,
            emoji: row.emoji ?? '',
            photoUrl:
              typeof row.photo_url === 'string' && row.photo_url.startsWith('http')
                ? row.photo_url
                : undefined,
            shopName: shop?.name ?? '',
            shopCategory: shop?.category ?? '',
            shopId: shop?.id ?? '',
          };
        });

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
