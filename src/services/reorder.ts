/**
 * services/reorder.ts — Reconstruit un panier depuis une commande passée.
 *
 * RÈGLES CRITIQUES :
 *  - Prix toujours rechargés depuis la DB (jamais les anciens)
 *  - Stock vérifié en temps réel (intégration Fonction 3 rupture de stock)
 *  - Commerce vérifié (actif, existant)
 *  - Articles correspondants par nom (les order_items ne stockent pas le productId)
 */

import { getShopById }  from './shops';
import { getProducts }  from './products';
import { CartShopInfo } from '../store/cartStore';
import { OrderItem }    from '../types/clientOrders';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReorderItem {
  id:    string;
  name:  string;
  emoji: string;
  price: number; // prix ACTUEL
  qty:   number;
}

export interface ReorderRemoved {
  name:   string;
  reason: 'unavailable' | 'deleted';
}

export interface ReorderPriceChange {
  name:     string;
  oldPrice: number;
  newPrice: number;
}

export type ReorderResult =
  | {
      ok:           true;
      shopId:       string;
      shopName:     string;
      shopInfo:     CartShopInfo;
      added:        ReorderItem[];
      removed:      ReorderRemoved[];
      priceChanged: ReorderPriceChange[];
    }
  | { ok: false; error: string };

// ─── Fonction principale ──────────────────────────────────────────────────────

export async function prepareReorder(
  shopId:    string,
  shopName:  string,
  prevItems: OrderItem[],
): Promise<ReorderResult> {
  if (!shopId) {
    return { ok: false, error: 'Identifiant du commerce introuvable.' };
  }

  // 1. Vérifier que le commerce existe encore
  let shop: Awaited<ReturnType<typeof getShopById>>;
  try {
    shop = await getShopById(shopId);
  } catch {
    return { ok: false, error: 'Impossible de vérifier le commerce. Réessaie.' };
  }
  if (!shop) {
    return { ok: false, error: 'Ce commerce n\'est plus disponible sur LASSİ.' };
  }

  // 2. Charger les produits actuels du commerce (prix + stock à jour)
  let currentProducts: Awaited<ReturnType<typeof getProducts>>;
  try {
    currentProducts = await getProducts(shopId);
  } catch {
    return { ok: false, error: 'Impossible de charger les produits. Réessaie.' };
  }

  // 3. Matcher chaque ancien article avec les produits actuels (par nom)
  const added:        ReorderItem[]       = [];
  const removed:      ReorderRemoved[]    = [];
  const priceChanged: ReorderPriceChange[] = [];

  for (const prev of prevItems) {
    const match = currentProducts.find(
      p => p.name.toLowerCase().trim() === prev.name.toLowerCase().trim()
    );

    if (!match) {
      removed.push({ name: prev.name, reason: 'deleted' });
      continue;
    }

    if (match.stock === 'out') {
      removed.push({ name: prev.name, reason: 'unavailable' });
      continue;
    }

    // Détecter un changement de prix
    const oldPrice = prev.price ?? 0;
    if (oldPrice > 0 && oldPrice !== match.price) {
      priceChanged.push({ name: match.name, oldPrice, newPrice: match.price });
    }

    added.push({
      id:    match.id,
      name:  match.name,
      emoji: match.emoji,
      price: match.price, // ← PRIX ACTUEL (jamais l'ancien)
      qty:   prev.qty ?? 1,
    });
  }

  // 4. Aucun article valide → pas de panier
  if (added.length === 0) {
    return {
      ok:    false,
      error: 'Aucun article de cette commande n\'est encore disponible.',
    };
  }

  const shopInfo: CartShopInfo = {
    id:       shopId,
    initial:  shopName.charAt(0).toUpperCase(),
    name:     shopName,
    location: `📍 ${shop.zone ?? ''}`,
    logoUrl:  shop.logoUrl ?? undefined,
  };

  return {
    ok: true,
    shopId,
    shopName,
    shopInfo,
    added,
    removed,
    priceChanged,
  };
}
