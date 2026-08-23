import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─── Mise à jour des produits mis en avant d'un abonnement "Offre du Quartier" ─
// Permet au marchand de changer quels éléments sont affichés dans le carrousel
// sans racheter un forfait. Supporte les produits, abonnements fitness et terrains.

const MAX_FEATURED_PRODUCTS = 50

const SPORT_EMOJI: Record<string, string> = {
  football: '⚽', basketball: '🏀', tennis: '🎾', volleyball: '🏐', autre: '🏟️',
}

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

    const uniqueIds = Array.from(new Set(productIds as string[]))

    // ⑤ Vérifier que tous les IDs appartiennent au marchand (produit, abonnement fitness, ou terrain)
    const [{ data: ownedProducts }, { data: ownedAbonnements }, { data: ownedTerrains }] = await Promise.all([
      admin.from('products')
        .select('id, name, price, emoji, photo_url')
        .eq('shop_id', shop.id)
        .in('id', uniqueIds),
      admin.from('fitness_abonnement_offres')
        .select('id, nom, prix')
        .eq('prestataire_id', user.id)
        .in('id', uniqueIds),
      admin.from('terrains')
        .select('id, nom, prix_horaire, sport_type')
        .eq('prestataire_id', user.id)
        .in('id', uniqueIds),
    ])

    type ProductRow = { id: string; name: string; price: number; emoji: string; photo_url: string }
    type AboRow    = { id: string; nom: string; prix: number }
    type TerrainRow = { id: string; nom: string; prix_horaire: number; sport_type: string }

    const productMap   = new Map((ownedProducts   ?? []).map((p: ProductRow)  => [p.id, p]))
    const aboMap       = new Map((ownedAbonnements ?? []).map((a: AboRow)     => [a.id, a]))
    const terrainMap   = new Map((ownedTerrains   ?? []).map((t: TerrainRow)  => [t.id, t]))

    const foundCount = productMap.size + aboMap.size + terrainMap.size
    if (foundCount !== uniqueIds.length) {
      return json({ error: "Un ou plusieurs éléments n'appartiennent pas à votre boutique" }, 400)
    }

    // ⑥ Mettre à jour l'abonnement
    const { error: subError } = await admin
      .from('visibility_subscriptions')
      .update({ product_id: uniqueIds[0] ?? null, product_ids: uniqueIds, all_products: false })
      .eq('id', sub.id)
    if (subError) throw subError

    // ⑦ Synchroniser shops.featured_product_ids (produits uniquement pour la bannière promo)
    const featuredProductIds = uniqueIds.filter(id => productMap.has(id))
    const { error: shopError } = await admin
      .from('shops')
      .update({
        featured_product_id:   featuredProductIds[0] ?? null,
        featured_product_ids:  featuredProductIds,
        featured_all_products: false,
        is_featured:           true,
      })
      .eq('id', shop.id)
    if (shopError) throw shopError

    // ⑧ Mettre à jour le carrousel "Offre du Quartier" (best-effort)
    const rows = uniqueIds
      .map((id, index) => {
        const base = {
          prestataire_id: user.id,
          rang_prestataire: null as null,
          ordre:          index,
          periode:        'paid',
          est_actif:      true,
          is_paid_pack:   true,
        }

        if (productMap.has(id)) {
          const p = productMap.get(id) as ProductRow
          const imageUrl = (typeof p.photo_url === 'string' && p.photo_url.startsWith('http'))
            ? p.photo_url
            : (p.emoji ?? '')
          return { ...base, product_id: id, terrain_id: null, abonnement_id: null, nom: p.name, prix: p.price, image_url: imageUrl }
        }
        if (aboMap.has(id)) {
          const a = aboMap.get(id) as AboRow
          return { ...base, product_id: null, terrain_id: null, abonnement_id: id, nom: a.nom, prix: a.prix, image_url: '🏋️' }
        }
        if (terrainMap.has(id)) {
          const t = terrainMap.get(id) as TerrainRow
          const emoji = SPORT_EMOJI[t.sport_type] ?? '🏟️'
          return { ...base, product_id: null, terrain_id: id, abonnement_id: null, nom: t.nom, prix: t.prix_horaire, image_url: emoji }
        }
        return null
      })
      .filter(Boolean)

    if (rows.length > 0) {
      await admin.from('carrousel_offre_quartier')
        .delete()
        .eq('prestataire_id', user.id)
        .eq('is_paid_pack', true)
        .catch(() => null)

      await admin.from('carrousel_offre_quartier')
        .insert(rows)
        .catch(() => null)
    }

    return json({ status: 'updated', productIds: uniqueIds })

  } catch (err: unknown) {
    console.error('[update-visibility-products]', err instanceof Error ? err.message : err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
