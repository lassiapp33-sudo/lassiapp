import { useState, useEffect, useMemo } from 'react';
import { SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
import { ProductPromoInfo, Promotion } from '../types/promotions';
import { buildProductPromoMap } from '../services/promotions';

export interface PromoItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  photoUrl?: string;
  shopName: string;
  shopCategory: string;
  shopId: string;
  promoInfo?: ProductPromoInfo;
}

const HEADERS = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
  'Content-Type': 'application/json',
};

async function pgFetch<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS, signal });
  if (!res.ok) return [];
  return res.json() as Promise<T[]>;
}

export function usePromoItems(): { items: PromoItem[]; loading: boolean } {
  const [raw, setRaw] = useState<PromoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        type ShopRow = {
          id: string;
          name: string;
          category: string;
          featured_product_id: string | null;
          featured_product_ids: string[] | null;
          featured_all_products: boolean;
        };

        // ① Commerces en vedette — direct fetch, contourne GoTrue lock
        const shopRows = await pgFetch<ShopRow>(
          'shops_effective?select=id,name,category,featured_product_id,featured_product_ids,featured_all_products&is_effectively_featured=eq.true',
          signal,
        );

        const allProductsShops = shopRows.filter(s => s.featured_all_products);
        const specificShops = shopRows.filter(s => !s.featured_all_products);

        const shopByProductId = new Map<string, ShopRow>();
        for (const s of specificShops) {
          const ids = s.featured_product_ids?.length
            ? s.featured_product_ids
            : s.featured_product_id ? [s.featured_product_id] : [];
          for (const id of ids) shopByProductId.set(id, s);
        }
        const specificIds = Array.from(shopByProductId.keys());

        // ② Produits — requêtes parallèles
        const [specificData, allProductsData] = await Promise.all([
          specificIds.length > 0
            ? pgFetch<Record<string, unknown>>(
                `products?select=id,name,price,emoji,photo_url,stock,shop_id&id=in.(${specificIds.join(',')})&stock=eq.in`,
                signal,
              )
            : Promise.resolve([]),
          allProductsShops.length > 0
            ? pgFetch<Record<string, unknown>>(
                `products?select=id,name,price,emoji,photo_url,stock,shop_id&shop_id=in.(${allProductsShops.map(s => s.id).join(',')})&stock=eq.in`,
                signal,
              )
            : Promise.resolve([]),
        ]);

        const shopById = new Map(allProductsShops.map(s => [s.id, s]));

        const toItem = (row: Record<string, unknown>, shop: ShopRow): PromoItem => ({
          id: row.id as string,
          name: row.name as string,
          price: row.price as number,
          emoji: (row.emoji as string) ?? '',
          photoUrl:
            typeof row.photo_url === 'string' && row.photo_url.startsWith('http')
              ? row.photo_url
              : undefined,
          shopName: shop.name,
          shopCategory: shop.category,
          shopId: shop.id,
        });

        const paidItems: PromoItem[] = [
          ...specificData
            .filter(r => shopByProductId.has(r.id as string))
            .map(r => toItem(r, shopByProductId.get(r.id as string)!)),
          ...allProductsData
            .filter(r => shopById.has(r.shop_id as string))
            .map(r => toItem(r, shopById.get(r.shop_id as string)!)),
        ];

        // ③ Carrousel récompenses classement
        type RewardRow = {
          id: string;
          prestataire_id: string;
          product_id: string | null;
          nom: string;
          prix: number;
          image_url: string;
        };
        const rewardRows = await pgFetch<RewardRow>(
          'carrousel_offre_quartier?select=id,prestataire_id,product_id,nom,prix,image_url&est_actif=eq.true&order=ordre&limit=25',
          signal,
        );

        let rewardItems: PromoItem[] = [];
        if (rewardRows.length > 0) {
          const merchantIds = [...new Set(rewardRows.map(r => r.prestataire_id).filter(Boolean))];
          type RewardShop = { id: string; name: string; category: string; merchant_id: string };
          const rewardShops = await pgFetch<RewardShop>(
            `shops?select=id,name,category,merchant_id&merchant_id=in.(${merchantIds.join(',')})`,
            signal,
          );
          const shopByMerchant = new Map(rewardShops.map(s => [s.merchant_id, s]));
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

        // ④ Promos actives pour tous les produits du carousel
        const allItems = [...paidItems, ...rewardItems];
        const productIds = allItems.map(i => i.id).filter(Boolean);
        let promoMap: Record<string, ProductPromoInfo> = {};

        if (productIds.length > 0) {
          const now = new Date().toISOString();
          const promoData = await pgFetch<Record<string, unknown>>(
            `promotions?select=*&cible_id=in.(${productIds.join(',')})&cible_type=eq.produit&actif=eq.true&or=(date_debut.is.null,date_debut.lte.${now})&or=(date_fin.is.null,date_fin.gte.${now})`,
            signal,
          );
          if (promoData.length > 0) {
            promoMap = buildProductPromoMap(
              promoData.map((r): Promotion => ({
                id: r.id as string,
                shopId: r.shop_id as string,
                titre: r.titre as string,
                type: r.type as Promotion['type'],
                valeur: Number(r.valeur),
                cibleType: r.cible_type as Promotion['cibleType'],
                cibleId: (r.cible_id as string | null) ?? undefined,
                montantMin: Number(r.montant_min ?? 0),
                dateDebut: (r.date_debut as string | null) ?? undefined,
                dateFin: (r.date_fin as string | null) ?? undefined,
                actif: r.actif as boolean,
                createdAt: r.created_at as string,
              })),
            );
          }
        }

        if (!signal.aborted) {
          setRaw(allItems.map(item => ({ ...item, promoInfo: promoMap[item.id] })));
          setLoading(false);
        }
      } catch {
        if (!signal.aborted) setLoading(false);
      }
    })();

    return () => { controller.abort(); };
  }, []);

  const items = useMemo(() => [...raw].sort(() => Math.random() - 0.5), [raw]);
  return { items, loading };
}
