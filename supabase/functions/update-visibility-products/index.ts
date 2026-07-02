import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─── Mise à jour des produits mis en avant d'un abonnement "Offre du Quartier" ─
// Permet au marchand de changer quels produits sont affichés dans le carrousel
// sans racheter un forfait. Le quota (nombre de produits achetés) est respecté.

const MAX_FEATURED_PRODUCTS = 50

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    // ① Authentification
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Validation du body
    const { productIds } = await req.json()
    if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > MAX_FEATURED_PRODUCTS) {
      return json({ error: 'productIds invalide (1–50 UUIDs)' }, 400)
    }
    if (!productIds.every(isUUID)) {
      return json({ error: 'productIds contient des identifiants invalides' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Trouver la boutique du marchand
    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', user.id)
      .maybeSingle()
    if (!shop) return json({ error: 'Boutique introuvable' }, 404)

    // ④ Trouver l'abonnement actif "quartier"
    const now = new Date().toISOString()
    const { data: sub } = await admin
      .from('visibility_subscriptions')
      .select('id, product_ids, all_products')
      .eq('shop_id', shop.id)
      .eq('status', 'active')
      .eq('offer_type', 'quartier')
      .gt('expires_at', now)
      .maybeSingle()

    if (!sub) return json({ error: 'Aucun abonnement Offre du Quartier actif trouvé' }, 404)
    if (sub.all_products) {
      return json({ error: 'Cet abonnement couvre toute la vitrine — pas de sélection individuelle' }, 400)
    }

    // ⑤ Respecter le quota d'origine (nombre de slots achetés)
    const currentIds = (sub.product_ids as string[] | null) ?? []
    const maxProducts = Math.max(1, currentIds.length)
    const uniqueIds = Array.from(new Set(productIds as string[]))
    if (uniqueIds.length > maxProducts) {
      return json({ error: `Maximum ${maxProducts} produit(s) pour cet abonnement` }, 400)
    }

    // ⑥ Vérifier que tous les produits appartiennent à la boutique
    const { data: ownedProducts } = await admin
      .from('products')
      .select('id')
      .eq('shop_id', shop.id)
      .in('id', uniqueIds)

    if (!ownedProducts || ownedProducts.length !== uniqueIds.length) {
      return json({ error: "Un ou plusieurs produits n'appartiennent pas à votre boutique" }, 400)
    }

    // ⑦ Mettre à jour l'abonnement
    const { error: subError } = await admin
      .from('visibility_subscriptions')
      .update({ product_id: uniqueIds[0] ?? null, product_ids: uniqueIds })
      .eq('id', sub.id)
    if (subError) throw subError

    // ⑧ Synchroniser shops.featured_product_ids
    const { error: shopError } = await admin
      .from('shops')
      .update({ featured_product_id: uniqueIds[0] ?? null, featured_product_ids: uniqueIds })
      .eq('id', shop.id)
    if (shopError) throw shopError

    // ⑨ Mettre à jour le carrousel "Offre du Quartier" (même source que les récompenses classement)
    const { data: prodDetails } = await admin
      .from('products')
      .select('id, name, price, emoji, photo_url')
      .in('id', uniqueIds)

    if (prodDetails && prodDetails.length > 0) {
      // Supprimer les anciennes entrées payantes du marchand
      await admin
        .from('carrousel_offre_quartier')
        .delete()
        .eq('prestataire_id', user.id)
        .eq('is_paid_pack', true)

      // Insérer les nouvelles entrées
      const rows = uniqueIds
        .map((id, index) => {
          const p = prodDetails.find((pr: { id: string }) => pr.id === id)
          if (!p) return null
          const imageUrl =
            typeof (p as { photo_url?: string }).photo_url === 'string' &&
            (p as { photo_url: string }).photo_url.startsWith('http')
              ? (p as { photo_url: string }).photo_url
              : ((p as { emoji?: string }).emoji ?? '')
          return {
            prestataire_id: user.id,
            product_id:     id,
            nom:            (p as { name: string }).name,
            prix:           (p as { price: number }).price,
            image_url:      imageUrl,
            rang_prestataire: null,
            ordre:          index,
            periode:        'paid',
            est_actif:      true,
            is_paid_pack:   true,
          }
        })
        .filter(Boolean)

      if (rows.length > 0) {
        await admin.from('carrousel_offre_quartier').insert(rows)
      }
    }

    return json({ status: 'updated', productIds: uniqueIds })

  } catch (err: unknown) {
    console.error('[update-visibility-products]', err instanceof Error ? err.message : err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
