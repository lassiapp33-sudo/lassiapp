import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
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
const BOOST_DURATION_LABELS: Record<string, string> = { '1m': '1 mois', '3m': '3 mois', '6m': '6 mois' }

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
    if (offerType === 'quartier' && !wantsAllProducts) {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return json({ error: 'productIds requis (ou allProducts: true)' }, 400)
      }
      if (productIds.length > MAX_FEATURED_PRODUCTS || !productIds.every(isUUID)) {
        return json({ error: 'productIds invalide' }, 400)
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

      // Pas de double abonnement actif pour ce type d'offre
      const nowIso = new Date().toISOString()
      const { data: existing } = await admin
        .from('visibility_subscriptions')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('offer_type', 'quartier')
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .maybeSingle()

      if (existing) return json({ error: 'Un abonnement actif existe déjà' }, 409)

    } else {
      // findBoostPlan vérifie déjà l'existence du planId — pas besoin de double check
      const plan = findBoostPlan(planId)
      if (!plan) return json({ error: 'Forfait introuvable' }, 404)

      price = plan.price
      durationDays = plan.durationDays
      planLabel = BOOST_DURATION_LABELS[plan.id] ?? `${durationDays} jours`
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
      // spend_shop_credit retourne NULL si le solde était insuffisant (race condition)
      return json({ error: 'Solde insuffisant', required: price }, 400)
    }

    // Helper de remboursement — appelé si l'activation échoue APRÈS le débit.
    // Le remboursement est best-effort : en cas d'échec, on logue et on laisse
    // l'opérateur corriger manuellement via le dashboard admin.
    const doRefund = async () => {
      const { error: refundErr } = await admin.rpc('increment_shop_credit', {
        p_shop_id: shop.id,
        p_amount: price,
      })
      if (refundErr) {
        console.error('[create-credit-purchase] REMBOURSEMENT ÉCHOUÉ — intervention manuelle requise', {
          shop_id: shop.id, amount: price, error: refundErr.message,
        })
      }
    }

    // ⑥ Activer le forfait — application immédiate, sans attente de webhook
    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationDays * 86_400_000)
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
        // Rembourser dans TOUS les cas (23505 = double-clic, autres = erreur inattendue)
        await doRefund()
        if (subError.code === '23505') {
          return json({ error: 'Un abonnement actif existe déjà' }, 409)
        }
        throw subError
      }

      const { error: shopsErr } = await admin
        .from('shops')
        .update({
          is_featured:           true,
          featured_product_id:   wantsAllProducts ? null : (featuredProductIds[0] ?? null),
          featured_product_ids:  wantsAllProducts ? [] : featuredProductIds,
          featured_all_products: wantsAllProducts,
        })
        .eq('id', shop.id)

      if (shopsErr) {
        // Supprimer l'abonnement orphelin (status='active') avant de rembourser,
        // sinon l'index unique bloque tous les achats futurs pour cette boutique.
        await admin.from('visibility_subscriptions').delete().eq('id', sub.id)
        await doRefund()
        throw shopsErr
      }

      // Alimenter le carrousel "Offre du Quartier" (best-effort)
      if (!wantsAllProducts && featuredProductIds.length > 0) {
        const { data: prodDetails } = await admin
          .from('products')
          .select('id, name, price, emoji, photo_url')
          .in('id', featuredProductIds)

        if (prodDetails && prodDetails.length > 0) {
          await admin.from('carrousel_offre_quartier').delete()
            .eq('prestataire_id', user.id).eq('is_paid_pack', true)

          const rows = featuredProductIds
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
            await admin.from('carrousel_offre_quartier').insert(rows).catch(() => null)
          }
        }
      }

      // Notification best-effort (pas de remboursement si elle échoue)
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
      if (rpcError) {
        await doRefund()
        throw rpcError
      }
      if (newUntil) {
        const d = new Date(newUntil as string)
        if (!isNaN(d.getTime())) responseExpiresAt = d
      }

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
      if (rpcError) {
        await doRefund()
        throw rpcError
      }
      if (newUntil) {
        const d = new Date(newUntil as string)
        if (!isNaN(d.getTime())) responseExpiresAt = d
      }

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
    console.error('[create-credit-purchase]', err instanceof Error ? err.message : err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
