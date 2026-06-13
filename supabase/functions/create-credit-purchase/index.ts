import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString, isBoolean } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { calculateOffreQuartierPrice } from '../_shared/offreQuartierPricing.ts'
import { findBoostPlan } from '../_shared/boostPlansPricing.ts'

// ─── Achat d'un forfait de visibilité avec le crédit LASSI ─────────────────────
// Permet à un marchand ayant reçu du crédit LASSI (don admin via
// admin-attribuer-recompense) de l'échanger immédiatement contre un forfait
// réel — "Offre du quartier", "Booster recherche" ou "Épingle dorée" (carte) —
// sans attendre l'intégration Wave / Orange Money. Le forfait est activé
// instantanément (pas de statut "pending").

const PLAN_ID_RE = /^[a-z0-9]+$/i
const MAX_FEATURED_PRODUCTS = 50
const BOOST_PLAN_IDS = new Set(['1m', '3m', '6m'])

type OfferType = 'quartier' | 'recherche' | 'carte'

const OFFER_LABELS: Record<OfferType, string> = {
  quartier: "l'Offre du Quartier",
  recherche: 'Booster recherche',
  carte: 'Épingle dorée (carte)',
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
    const { offerType, planId, productIds, allProducts } = await req.json()
    if (!['quartier', 'recherche', 'carte'].includes(offerType)) {
      return json({ error: 'offerType invalide (quartier | recherche | carte)' }, 400)
    }
    if (!isSafeString(planId, { maxLen: 20, minLen: 1, pattern: PLAN_ID_RE })) {
      return json({ error: 'planId invalide' }, 400)
    }

    const wantsAllProducts = allProducts === true
    if (offerType === 'quartier') {
      if (!wantsAllProducts) {
        if (!Array.isArray(productIds) || productIds.length === 0) {
          return json({ error: 'productIds requis (ou allProducts: true)' }, 400)
        }
        if (productIds.length > MAX_FEATURED_PRODUCTS || !productIds.every(isUUID)) {
          return json({ error: 'productIds invalide' }, 400)
        }
      } else if (allProducts !== undefined && !isBoolean(allProducts)) {
        return json({ error: 'allProducts invalide' }, 400)
      }
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Vérifier que l'utilisateur possède bien une boutique
    const { data: shop } = await admin
      .from('shops')
      .select('id, credit_balance')
      .eq('merchant_id', user.id)
      .maybeSingle()

    if (!shop) return json({ error: 'Boutique introuvable' }, 404)

    // ④ Calculer le prix réel et la durée selon l'offre — jamais depuis le client
    let price: number
    let durationDays: number
    let planLabel: string
    let featuredProductIds: string[] = []

    if (offerType === 'quartier') {
      const { data: plan } = await admin
        .from('visibility_plans')
        .select('id, label, price, duration_days')
        .eq('id', planId)
        .eq('active', true)
        .maybeSingle()

      if (!plan) return json({ error: 'Forfait introuvable ou inactif' }, 404)

      if (!wantsAllProducts) {
        const uniqueIds = Array.from(new Set(productIds as string[]))
        const { data: ownedProducts } = await admin
          .from('products')
          .select('id')
          .eq('shop_id', shop.id)
          .in('id', uniqueIds)

        if (!ownedProducts || ownedProducts.length !== uniqueIds.length) {
          return json({ error: 'Produit invalide' }, 400)
        }
        featuredProductIds = uniqueIds
      }

      let nbProduits = featuredProductIds.length
      if (wantsAllProducts) {
        const { count } = await admin
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shop.id)
        nbProduits = count ?? 0
      }

      price = calculateOffreQuartierPrice(plan.price, nbProduits)
      durationDays = plan.duration_days
      planLabel = plan.label

      // Pas de double abonnement actif
      const now = new Date().toISOString()
      const { data: existing } = await admin
        .from('visibility_subscriptions')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('status', 'active')
        .gt('expires_at', now)
        .maybeSingle()

      if (existing) return json({ error: 'Un abonnement actif existe déjà' }, 409)

    } else {
      if (!BOOST_PLAN_IDS.has(planId)) return json({ error: 'Forfait introuvable' }, 404)
      const plan = findBoostPlan(planId)
      if (!plan) return json({ error: 'Forfait introuvable' }, 404)

      price = plan.price
      durationDays = plan.durationDays
      planLabel = `${durationDays === 30 ? '1 mois' : durationDays === 90 ? '3 mois' : '6 mois'}`
    }

    // ⑤ Vérifier et débiter le portefeuille — atomique, échoue si solde insuffisant
    if (shop.credit_balance < price) {
      return json({ error: 'Solde insuffisant', balance: shop.credit_balance, required: price }, 400)
    }

    const { data: newBalance, error: spendError } = await admin.rpc('spend_shop_credit', {
      p_shop_id: shop.id,
      p_amount: price,
    })
    if (spendError) throw spendError
    if (newBalance === null) {
      return json({ error: 'Solde insuffisant', balance: shop.credit_balance, required: price }, 400)
    }

    // ⑥ Activer le forfait — application immédiate, sans attente de webhook
    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationDays * 86_400_000)
    // Pour 'recherche'/'carte', les RPC grant_* prolongent depuis l'expiration
    // existante (cumul) — la vraie date renvoyée par RETURNING peut différer
    // du calcul ci-dessus. Mis à jour plus bas si un boost était déjà actif.
    let responseExpiresAt = expiresAt

    if (offerType === 'quartier') {
      const { data: sub, error: subError } = await admin
        .from('visibility_subscriptions')
        .insert({
          shop_id:      shop.id,
          merchant_id:  user.id,
          plan_id:      planId,
          product_id:   featuredProductIds[0] ?? null,
          product_ids:  featuredProductIds,
          all_products: wantsAllProducts,
          amount:       price,
          pay_method:   'credit',
          status:       'active',
          started_at:   now.toISOString(),
          expires_at:   expiresAt.toISOString(),
          paid_at:      now.toISOString(),
        })
        .select('id')
        .single()

      if (subError) {
        if (subError.code === '23505') {
          // Un abonnement actif a été créé entre-temps (double-clic/retry) —
          // rembourser le crédit déjà débité par spend_shop_credit ci-dessus.
          await admin.rpc('increment_shop_credit', { p_shop_id: shop.id, p_amount: price })
          return json({ error: 'Un abonnement actif existe déjà' }, 409)
        }
        throw subError
      }

      await admin
        .from('shops')
        .update({
          is_featured:           true,
          featured_product_id:   wantsAllProducts ? null : (featuredProductIds[0] ?? null),
          featured_product_ids:  wantsAllProducts ? [] : featuredProductIds,
          featured_all_products: wantsAllProducts,
        })
        .eq('id', shop.id)

      await admin.from('notifications').insert({
        user_id: user.id,
        type:    'vip',
        title:   '🎉 Forfait activé avec ton crédit LASSI !',
        body:    `Ton crédit LASSI a été utilisé pour activer le forfait « ${planLabel} » de ${OFFER_LABELS.quartier} jusqu'au ${expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Il te reste ${newBalance.toLocaleString('fr-FR')} FCFA de crédit.`,
        data:    { subscription_id: sub.id, offer_type: 'quartier' },
      })

    } else if (offerType === 'recherche') {
      const { data: newUntil, error: rpcError } = await admin.rpc('grant_recherche_boost', {
        p_shop_id: shop.id,
        p_days: durationDays,
      })
      if (rpcError) throw rpcError
      if (newUntil) responseExpiresAt = new Date(newUntil as string)

      await admin.from('notifications').insert({
        user_id: user.id,
        type:    'vip',
        title:   '🎉 Forfait activé avec ton crédit LASSI !',
        body:    `Ton crédit LASSI a été utilisé pour activer « ${planLabel} » de ${OFFER_LABELS.recherche} jusqu'au ${responseExpiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Il te reste ${newBalance.toLocaleString('fr-FR')} FCFA de crédit.`,
        data:    { offer_type: 'recherche' },
      })

    } else {
      const { data: newUntil, error: rpcError } = await admin.rpc('grant_carte_pin', {
        p_shop_id: shop.id,
        p_days: durationDays,
      })
      if (rpcError) throw rpcError
      if (newUntil) responseExpiresAt = new Date(newUntil as string)

      await admin.from('notifications').insert({
        user_id: user.id,
        type:    'vip',
        title:   '🎉 Forfait activé avec ton crédit LASSI !',
        body:    `Ton crédit LASSI a été utilisé pour activer « ${planLabel} » de ${OFFER_LABELS.carte} jusqu'au ${responseExpiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Il te reste ${newBalance.toLocaleString('fr-FR')} FCFA de crédit.`,
        data:    { offer_type: 'carte' },
      })
    }

    return json({
      status:      'active',
      offerType,
      expiresAt:   responseExpiresAt.toISOString(),
      amountSpent: price,
      newBalance,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
