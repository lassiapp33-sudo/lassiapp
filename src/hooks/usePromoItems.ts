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

    supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        emoji,
        photo_url,
        shops ( id, name, category )
      `)
      .eq('stock', 'in')
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        const items: PromoItem[] = (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          price: row.price as number,
          emoji: row.emoji ?? '',
          photoUrl:
            typeof row.photo_url === 'string' && row.photo_url.startsWith('http')
              ? row.photo_url
              : undefined,
          shopName: row.shops?.name ?? '',
          shopCategory: row.shops?.category ?? '',
          shopId: row.shops?.id ?? '',
        }));
        setRaw(items);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Mélange aléatoire stabilisé au montage (ne re-shuffle pas sur re-render)
  const items = useMemo(() => [...raw].sort(() => Math.random() - 0.5), [raw]);

  return { items, loading };
}
