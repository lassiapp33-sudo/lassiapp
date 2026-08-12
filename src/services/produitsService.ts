/**
 * Service dédié à la création de produits depuis le scan OCR.
 * Wrapper léger sur la table `products` — résout shopId automatiquement.
 *
 * Pour activer le tracking d'origine (optionnel) :
 *   ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manuel';
 * Puis décommenter la ligne `source:` dans les rows ci-dessous.
 */

import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProduitScan {
  nom: string;
  prix: number;
}

export interface ResultatCreation {
  success: boolean;
  count: number;
  error?: string;
}

// ─── Résolution du shopId ─────────────────────────────────────────────────────

async function resolveShopId(): Promise<string | null> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;

  const { data } = await supabase
    .from('shops')
    .select('id')
    .eq('merchant_id', userId)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

// ─── Création en masse (source : scan OCR) ────────────────────────────────────

export const creerProduitsEnMasse = async (
  produits: ProduitScan[],
): Promise<ResultatCreation> => {
  if (produits.length === 0) return { success: true, count: 0 };

  const shopId = await resolveShopId();
  if (!shopId) return { success: false, count: 0, error: 'Boutique introuvable — reconnecte-toi.' };

  const rows = produits.map(p => ({
    shop_id:     shopId,
    name:        p.nom,
    price:       p.prix,
    description: '',
    emoji:       '',
    photo_url:   '',
    category:    'general',
    stock:       'in',
    item_type:   'product',
    // source: 'scan_ocr', // Décommenter après migration ci-dessus
  }));

  const { error, count } = await supabase.from('products').insert(rows);
  if (error) return { success: false, count: 0, error: error.message };

  return { success: true, count: count ?? rows.length };
};
