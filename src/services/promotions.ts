import { supabase }         from '../lib/supabase';
import { Promotion, AppliedDiscount, ProductPromoInfo } from '../types/promotions';
import { CartItem }          from '../store/cartStore';
import { formatPrice }       from '../utils/format';

// ─── Mapping DB → TS ─────────────────────────────────────────────────────────

function rowToPromo(row: Record<string, any>): Promotion {
  return {
    id:         row.id,
    shopId:     row.shop_id,
    titre:      row.titre,
    type:       row.type,
    valeur:     Number(row.valeur),
    cibleType:  row.cible_type,
    cibleId:    row.cible_id  ?? undefined,
    montantMin: Number(row.montant_min ?? 0),
    dateDebut:  row.date_debut ?? undefined,
    dateFin:    row.date_fin   ?? undefined,
    actif:      row.actif,
    createdAt:  row.created_at,
  };
}

// ─── Requêtes ─────────────────────────────────────────────────────────────────

/** Toutes les promos d'un shop (pour la gestion prestataire). */
export async function getShopPromos(shopId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPromo);
}

/** Promos actives d'un shop pour l'affichage client (vitrine + panier). */
export async function getActivePromos(shopId: string): Promise<Promotion[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('shop_id', shopId)
    .eq('actif', true)
    .or(`date_debut.is.null,date_debut.lte.${now}`)
    .or(`date_fin.is.null,date_fin.gte.${now}`);
  if (error) return [];
  return (data ?? []).map(rowToPromo);
}

/** Crée une promo. */
export async function createPromo(
  shopId: string,
  promo: Omit<Promotion, 'id' | 'shopId' | 'createdAt'>,
): Promise<Promotion> {
  const { data, error } = await supabase
    .from('promotions')
    .insert({
      shop_id:    shopId,
      titre:      promo.titre,
      type:       promo.type,
      valeur:     promo.valeur,
      cible_type: promo.cibleType,
      cible_id:   promo.cibleId   ?? null,
      montant_min: promo.montantMin,
      date_debut: promo.dateDebut ?? null,
      date_fin:   promo.dateFin   ?? null,
      actif:      promo.actif,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPromo(data);
}

/** Met à jour une promo. */
export async function updatePromo(
  promoId: string,
  updates: Partial<Omit<Promotion, 'id' | 'shopId' | 'createdAt'>>,
): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.titre      !== undefined) row.titre       = updates.titre;
  if (updates.type       !== undefined) row.type        = updates.type;
  if (updates.valeur     !== undefined) row.valeur      = updates.valeur;
  if (updates.cibleType  !== undefined) row.cible_type  = updates.cibleType;
  if (updates.cibleId    !== undefined) row.cible_id    = updates.cibleId ?? null;
  if (updates.montantMin !== undefined) row.montant_min = updates.montantMin;
  if (updates.dateDebut  !== undefined) row.date_debut  = updates.dateDebut ?? null;
  if (updates.dateFin    !== undefined) row.date_fin    = updates.dateFin   ?? null;
  if (updates.actif      !== undefined) row.actif       = updates.actif;
  const { error } = await supabase.from('promotions').update(row).eq('id', promoId);
  if (error) throw new Error(error.message);
}

/** Active ou désactive une promo (toggle rapide). */
export async function togglePromo(promoId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from('promotions').update({ actif }).eq('id', promoId);
  if (error) throw new Error(error.message);
}

/** Supprime une promo. */
export async function deletePromo(promoId: string): Promise<void> {
  const { error } = await supabase.from('promotions').delete().eq('id', promoId);
  if (error) throw new Error(error.message);
}

// ─── Calcul client-side (affichage uniquement — le serveur recalcule) ─────────

/**
 * Calcule la réduction à afficher dans le panier.
 * Ne JAMAIS envoyer ce montant au serveur — le serveur recalcule lui-même.
 */
export function calcClientDiscount(
  promos:             Promotion[],
  items:              CartItem[],
  productCategories?: Record<string, string>, // productId → categoryId
): AppliedDiscount[] {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const results: AppliedDiscount[] = [];

  for (const promo of promos) {
    if (promo.montantMin > 0 && subtotal < promo.montantMin) continue;

    let reduction = 0;
    let label     = '';

    switch (promo.type) {
      case 'pourcentage': {
        let base = 0;
        if (promo.cibleType === 'vitrine') {
          base  = subtotal;
          label = `-${promo.valeur}% sur tout`;
        } else if (promo.cibleType === 'produit' && promo.cibleId) {
          base  = items.filter(i => i.id === promo.cibleId)
                       .reduce((s, i) => s + i.price * i.qty, 0);
          label = `-${promo.valeur}%`;
        } else if (promo.cibleType === 'categorie' && promo.cibleId && productCategories) {
          base  = items.filter(i => productCategories[i.id] === promo.cibleId)
                       .reduce((s, i) => s + i.price * i.qty, 0);
          label = `-${promo.valeur}% catégorie`;
        }
        reduction = Math.round(base * promo.valeur / 100);
        break;
      }

      case 'montant_fixe': {
        if (promo.cibleType === 'vitrine') {
          reduction = Math.min(promo.valeur, subtotal - 1);
          label     = `-${formatPrice(promo.valeur)}`;
        }
        break;
      }

      case 'quantite_offerte': {
        // Buy X get 1 free (promo.valeur = X)
        if (promo.cibleType === 'produit' && promo.cibleId) {
          const targets  = items.filter(i => i.id === promo.cibleId);
          const totalQty = targets.reduce((s, i) => s + i.qty, 0);
          const freeQty  = Math.floor(totalQty / (promo.valeur + 1));
          if (freeQty > 0 && targets[0]) {
            reduction = targets[0].price * freeQty;
            label     = `${promo.valeur}+1 offert`;
          }
        }
        break;
      }

      case 'prix_barre': {
        // valeur = nouveau prix du produit
        if (promo.cibleType === 'produit' && promo.cibleId) {
          const targets = items.filter(i => i.id === promo.cibleId);
          const orig    = targets.reduce((s, i) => s + i.price * i.qty, 0);
          const promo_  = targets.reduce((s, i) => s + promo.valeur * i.qty, 0);
          reduction     = orig - promo_;
          label         = `Prix promo`;
        }
        break;
      }
    }

    if (reduction > 0) {
      results.push({
        promoId:       promo.id,
        titre:         promo.titre,
        type:          promo.type,
        reductionFcfa: reduction,
        label,
      });
      break; // une seule promo à la fois — la première applicable
    }
  }

  return results;
}

/**
 * Construit une map productId → ProductPromoInfo pour l'affichage vitrine.
 * Seules les promos de type 'produit' génèrent un badge sur le tile.
 */
export function buildProductPromoMap(
  promos: Promotion[],
): Record<string, ProductPromoInfo> {
  const map: Record<string, ProductPromoInfo> = {};
  for (const promo of promos) {
    if (promo.cibleType !== 'produit' || !promo.cibleId) continue;
    const existing = map[promo.cibleId];
    if (existing) continue; // garder la première (tri par date desc depuis l'API)

    if (promo.type === 'pourcentage') {
      map[promo.cibleId] = { badge: `-${promo.valeur}%` };
    } else if (promo.type === 'montant_fixe') {
      map[promo.cibleId] = { badge: `-${formatPrice(promo.valeur)}` };
    } else if (promo.type === 'quantite_offerte') {
      map[promo.cibleId] = { badge: `${promo.valeur}+1` };
    } else if (promo.type === 'prix_barre') {
      map[promo.cibleId] = { badge: 'Promo', promoPrice: promo.valeur };
    }
  }
  return map;
}

/** Renvoie true si le shop a au moins une promo de portée vitrine ou catégorie active. */
export function hasShopWidePromo(promos: Promotion[]): boolean {
  return promos.some(p => p.cibleType === 'vitrine' || p.cibleType === 'categorie');
}
