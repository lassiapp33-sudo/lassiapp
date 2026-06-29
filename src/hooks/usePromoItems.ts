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
        // ① Commerces avec une "Offre du quartier" effective (don admin OU abonnement payé)
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

        const paidItems: PromoItem[] = [
          ...(specificRes.data ?? [])
            .filter((row: any) => shopByProductId.has(row.id))
            .map((row: any) => toItem(row, shopByProductId.get(row.id)!)),
          ...(allProductsRes.data ?? [])
            .filter((row: any) => shopById.has(row.shop_id))
            .map((row: any) => toItem(row, shopById.get(row.shop_id)!)),
        ];

        // ③ Produits gagnés via récompenses classement (carrousel_offre_quartier)
        const { data: carrouselData } = await supabase
          .from('carrousel_offre_quartier')
          .select('id, prestataire_id, product_id, nom, prix, image_url')
          .eq('est_actif', true)
          .order('ordre')
          .limit(25);

        type RewardRow = {
          id: string;
          prestataire_id: string;
          product_id: string | null;
          nom: string;
          prix: number;
          image_url: string;
        };
        const rewardRows = (carrouselData ?? []) as RewardRow[];

        let rewardItems: PromoItem[] = [];
        if (rewardRows.length > 0) {
          const merchantIds = [...new Set(rewardRows.map(r => r.prestataire_id).filter(Boolean))];
          const { data: rewardShops } = await supabase
            .from('shops')
            .select('id, name, category, merchant_id')
            .in('merchant_id', merchantIds);

          type RewardShop = { id: string; name: string; category: string; merchant_id: string };
          const shopByMerchant = new Map<string, RewardShop>(
            (rewardShops ?? []).map((s: any) => [s.merchant_id, s]),
          );

          // Dédupliquer : ne pas afficher deux fois un produit déjà dans paidItems
          const paidProductIds = new Set(paidItems.map(i => i.id));

          rewardItems = rewardRows
            .filter(r => r.product_id && !paidProductIds.has(r.product_id))
            .map(r => {
              const shop = shopByMerchant.get(r.prestataire_id);
              const isUrl = typeof r.image_url === 'string' && r.image_url.startsWith('http');
              return {
                id: r.product_id!,
                name: r.nom,
                price: r.prix,
                emoji: isUrl ? '' : (r.image_url ?? ''),
                photoUrl: isUrl ? r.image_url : undefined,
                shopName: shop?.name ?? '',
                shopCategory: shop?.category ?? '',
                shopId: shop?.id ?? '',
              };
            });
        }

        if (!cancelled) {
          setRaw([...paidItems, ...rewardItems]);
          setLoading(false);
        }
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
