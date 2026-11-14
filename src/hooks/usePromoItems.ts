import { useState, useEffect, useMemo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const CACHE_KEY = 'promo_items_cache_v2';

function prefetchImages(items: PromoItem[]): void {
  items.forEach(item => {
    if (item.photoUrl) ExpoImage.prefetch(item.photoUrl, { cachePolicy: 'disk' }).catch(() => {});
  });
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

export function usePromoItems(): { items: PromoItem[]; loading: boolean; isConnected: boolean } {
  const [raw, setRaw] = useState<PromoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Phase 1 : charge le cache AsyncStorage immédiatement
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then(json => {
        if (json) {
          const cached: PromoItem[] = JSON.parse(json);
          if (cached.length > 0) {
            setRaw(cached);
            setLoading(false);
            prefetchImages(cached);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Phase 2 : fetch réseau en arrière-plan
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
            .map(r => toItem(r, shopByProductId.get(r.id as string) as Parameters<typeof toItem>[1])),
          ...allProductsData
            .filter(r => shopById.has(r.shop_id as string))
            .map(r => toItem(r, shopById.get(r.shop_id as string) as Parameters<typeof toItem>[1])),
        ];

        type RewardRow = {
          id: string;
          prestataire_id: string;
          product_id: string | null;
          terrain_id: string | null;
          abonnement_id: string | null;
          beauty_service_id: string | null;
          nom: string;
          prix: number;
          image_url: string;
        };
        const rewardRows = await pgFetch<RewardRow>(
          'carrousel_offre_quartier?select=id,prestataire_id,product_id,terrain_id,abonnement_id,beauty_service_id,nom,prix,image_url&est_actif=eq.true&order=ordre&limit=200',
          signal,
        );

        let rewardItems: PromoItem[] = [];
        if (rewardRows.length > 0) {
          type RewardShop = { id: string; name: string; category: string; merchant_id: string };

          // Résoudre shop via product_id→shop_id pour les marchands multi-boutiques
          const productIds2 = rewardRows.map(r => r.product_id).filter(Boolean) as string[];
          type ProdShop = { id: string; shop_id: string };
          const prodShopRows = productIds2.length > 0
            ? await pgFetch<ProdShop>(
                `products?select=id,shop_id&id=in.(${productIds2.join(',')})`,
                signal,
              )
            : [];
          const shopIdByProductId = new Map(prodShopRows.map(p => [p.id, p.shop_id]));

          // Collecter les shop_ids + merchant_ids pour la requête shops
          const shopIds2 = [...new Set(prodShopRows.map(p => p.shop_id).filter(Boolean))];
          const merchantIds = [...new Set(rewardRows.map(r => r.prestataire_id).filter(Boolean))];
          const allShopFilter = shopIds2.length > 0
            ? `shops?select=id,name,category,merchant_id&or=(id.in.(${shopIds2.join(',')}),merchant_id.in.(${merchantIds.join(',')}))`
            : `shops?select=id,name,category,merchant_id&merchant_id=in.(${merchantIds.join(',')})`;
          const rewardShops = await pgFetch<RewardShop>(allShopFilter, signal);
          const shopById2 = new Map(rewardShops.map(s => [s.id, s]));
          const shopByMerchant = new Map(rewardShops.map(s => [s.merchant_id, s]));
          const paidProductIds = new Set(paidItems.map(i => i.id));

          rewardItems = rewardRows
            .filter(r => (r.product_id || r.terrain_id || r.abonnement_id || r.beauty_service_id) && (!r.product_id || !paidProductIds.has(r.product_id)))
            .map(r => {
              // Priorité : shop via product_id→shop_id, sinon merchant_id
              const shopId = r.product_id ? shopIdByProductId.get(r.product_id) : undefined;
              const shop = (shopId ? shopById2.get(shopId) : undefined) ?? shopByMerchant.get(r.prestataire_id);
              const isUrl = typeof r.image_url === 'string' && r.image_url.startsWith('http');
              return {
                id: r.product_id ?? r.terrain_id ?? r.abonnement_id ?? r.beauty_service_id ?? '',
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
          const freshItems = allItems.map(item => ({ ...item, promoInfo: promoMap[item.id] }));
          // Ne garder que les produits dont l'image se charge VRAIMENT. Beaucoup
          // de photo_url pointent vers des fichiers supprimés du storage (HTTP 400)
          // → l'URL existe mais l'image est morte. prefetch résout false/throw dans
          // ce cas, on exclut. Se répare seul si le marchand ré-uploade une image.
          const checks = await Promise.all(
            freshItems.map(async it => {
              if (!it.photoUrl) return false;
              try { return await ExpoImage.prefetch(it.photoUrl, { cachePolicy: 'disk' }); }
              catch { return false; }
            }),
          );
          const liveItems = freshItems.filter((_, i) => checks[i]);
          if (!signal.aborted) {
            setRaw(liveItems);
            setLoading(false);
            setIsConnected(true);
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(liveItems)).catch(() => {});
          }
        }
      } catch {
        if (!signal.aborted) {
          // Réseau indisponible — on garde le cache déjà chargé, pas de défilement auto
          setLoading(false);
          setIsConnected(false);
        }
      }
    })();

    return () => { controller.abort(); };
  }, []);

  // Offre du quartier : on n'affiche QUE les produits avec une vraie image
  // (photoUrl http). Les items sans image (emoji seul / fallback) sont exclus.
  const items = useMemo(
    () => raw.filter(i => !!i.photoUrl).sort(() => Math.random() - 0.5),
    [raw],
  );
  return { items, loading, isConnected };
}
