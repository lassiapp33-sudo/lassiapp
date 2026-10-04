// Peuple carrousel_offre_quartier après activation d'un pack payant visibilité "quartier".
// Colonne is_paid_pack=true distingue ces entrées des récompenses classement (is_paid_pack=false).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Sb = ReturnType<typeof createClient>;

export async function populateCarrouselQuartier(
  supabase: Sb,
  merchantId: string,
  paidIds: string[],  // [] = tous les produits actifs
  _piId: string,
): Promise<void> {
  try {
    // 1. Supprimer les anciennes entrées payantes de ce marchand
    await supabase
      .from('carrousel_offre_quartier')
      .delete()
      .eq('prestataire_id', merchantId)
      .eq('is_paid_pack', true);

    // 2. Trouver les shop_id du marchand, puis ses produits
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('merchant_id', merchantId);

    const shopIds = (shops ?? []).map((s: Record<string, unknown>) => s.id as string);
    if (shopIds.length === 0) return;

    let query = supabase
      .from('products')
      .select('id, name, price, photo_url')
      .in('shop_id', shopIds)
      .order('created_at');

    if (paidIds.length > 0) {
      query = query.in('id', paidIds);
    }

    const { data: produits, error: prodErr } = await query.limit(10);
    if (prodErr) {
      console.error('[carrouselQuartier] fetch produits erreur:', prodErr.message);
      return;
    }

    if (!produits || produits.length === 0) return;

    // 3. Calculer période (mois courant)
    const now     = new Date();
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 4. Insérer les nouvelles entrées
    const rows = produits.map((p: Record<string, unknown>, idx: number) => ({
      prestataire_id: merchantId,
      product_id:     p.id,
      nom:            p.name,
      prix:           p.price,
      image_url:      p.photo_url ?? '',
      rang_prestataire: null,
      ordre:          idx,
      periode,
      est_actif:      true,
      is_paid_pack:   true,
    }));

    const { error: insErr } = await supabase.from('carrousel_offre_quartier').insert(rows);
    if (insErr) {
      console.error('[carrouselQuartier] insert erreur:', insErr.message);
    }
  } catch (e) {
    console.error('[carrouselQuartier] exception:', e instanceof Error ? e.message : e);
  }
}
