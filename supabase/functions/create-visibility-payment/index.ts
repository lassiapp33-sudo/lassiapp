import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString, isBoolean } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { calculateOffreQuartierPrice } from '../_shared/offreQuartierPricing.ts'
import { getOmToken, OM_BASE_URL } from '../_shared/omAuth.ts'

const PLAN_ID_RE = /^[a-z0-9]+$/i
const MAX_FEATURED_PRODUCTS = 50

const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? ''  // code marchand (6 chiffres)
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''

const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? ''
const WAVE_MERCHANT_ID = Deno.env.get('WAVE_MERCHANT_ID') ?? ''

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'lassi://'

const KEYS_READY = {
  wave:         !!(WAVE_API_KEY && WAVE_MERCHANT_ID),
  orange_money: !!(Deno.env.get('OM_CLIENT_ID') && Deno.env.get('OM_CLIENT_SECRET') && OM_MERCHANT_CODE),
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

  // GET : expose la disponibilité des clés (app l'appelle au chargement)
  if (req.method === 'GET') {
    return json({ wave: KEYS_READY.wave, orange_money: KEYS_READY.orange_money })
  }

  try {
    // ① Authentification utilisateur
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Validation du body
    const { planId, payMethod, productIds, allProducts } = await req.json()
    if (!planId || !payMethod) {
      return json({ error: 'planId et payMethod requis' }, 400)
    }
    if (!isSafeString(planId, { maxLen: 20, minLen: 1, pattern: PLAN_ID_RE })) {
      return json({ error: 'planId invalide' }, 400)
    }
    if (!['wave', 'orange_money'].includes(payMethod)) {
      return json({ error: 'payMethod invalide (wave | orange_money)' }, 400)
    }

    const wantsAllProducts = allProducts === true
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Clés non configurées → refuser proprement (pas de ligne orpheline en DB)
    if (!KEYS_READY[payMethod as keyof typeof KEYS_READY]) {
      return json({
        status:  'awaiting_keys',
        message: "Le paiement mobile est en cours d'intégration. Revenez bientôt !",
      })
    }

    // ④ Vérifier que l'utilisateur possède une boutique
    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', user.id)
      .maybeSingle()

    if (!shop) return json({ error: 'Boutique introuvable' }, 404)

    // ⑤ Charger le forfait depuis la DB (le prix vient toujours du serveur)
    const { data: plan } = await admin
      .from('visibility_plans')
      .select('id, label, price, duration_months, duration_days')
      .eq('id', planId)
      .eq('active', true)
      .maybeSingle()

    if (!plan) return json({ error: 'Forfait introuvable ou inactif' }, 404)

    // ⑤bis Vérifier que les produits appartiennent à cette boutique
    const featuredProductIds: string[] = []
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
      featuredProductIds.push(...uniqueIds)
    }

    // ⑤ter Prix dynamique (jamais accepté depuis le client)
    let nbProduits = featuredProductIds.length
    if (wantsAllProducts) {
      const { count } = await admin
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shop.id)
      nbProduits = count ?? 0
    }
    const finalPrice = calculateOffreQuartierPrice(plan.price, nbProduits)

    // ⑥ Vérifier l'absence d'abonnement actif
    const now = new Date().toISOString()
    const { data: existing } = await admin
      .from('visibility_subscriptions')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle()

    if (existing) return json({ error: 'Un abonnement actif existe déjà' }, 409)

    // ⑦ Créer la ligne pending avant l'appel API
    const { data: sub, error: subError } = await admin
      .from('visibility_subscriptions')
      .insert({
        shop_id:      shop.id,
        merchant_id:  user.id,
        plan_id:      plan.id,
        product_id:   featuredProductIds[0] ?? null,
        product_ids:  featuredProductIds,
        all_products: wantsAllProducts,
        amount:       finalPrice,
        pay_method:   payMethod,
        status:       'pending',
      })
      .select()
      .single()

    if (subError) throw subError

    // ⑧ Appel API de paiement
    let paymentUrl = ''   // Wave: checkout URL  /  OM: deepLink ouvrant l'app OM
    let qrCode     = ''   // OM seulement : image QR code base64 (fallback scan)
    let reference  = sub.id

    if (payMethod === 'wave') {
      // ── Wave Checkout ──────────────────────────────────────────────────────
      const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method:  'POST',
        headers: {
          'Authorization':   `Bearer ${WAVE_API_KEY}`,
          'Content-Type':    'application/json',
          'Idempotency-Key': sub.id,
        },
        body: JSON.stringify({
          currency:         'XOF',
          amount:           finalPrice,
          merchant_id:      WAVE_MERCHANT_ID,
          success_url:      `${APP_BASE_URL}visibility-success?sub=${sub.id}`,
          error_url:        `${APP_BASE_URL}visibility-error?sub=${sub.id}`,
          client_reference: sub.id,
        }),
      })
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')
      paymentUrl = waveData.wave_launch_url ?? ''
      reference  = waveData.id ?? sub.id

    } else {
      // ── Orange Money Sonatel — QR Code (POST /api/eWallet/v4/qrcode) ──────
      // Flux : génère un QR + deepLink → l'app ouvre le deepLink (app OM) →
      // l'utilisateur paie → Orange POST notre webhook → on active l'abonnement.
      const omToken = await getOmToken()

      // URL webhook : sub_id + secret en query param pour matching et sécurité.
      // Orange POST cette URL quand le paiement est finalisé (SUCCESS ou FAILED).
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const webhookUrl  =
        `${supabaseUrl}/functions/v1/verify-visibility-payment` +
        `?sub_id=${encodeURIComponent(sub.id)}` +
        `&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`

      const omRes = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
        method:  'POST',
        headers: {
          'Authorization':  `Bearer ${omToken}`,
          'Content-Type':   'application/json',
          'X-Callback-Url': webhookUrl,
        },
        body: JSON.stringify({
          code:     OM_MERCHANT_CODE,
          name:     'LASSI',
          amount:   { value: finalPrice, unit: 'XOF' },
          validity: 900,  // 15 minutes
          metadata: { subscription_id: sub.id },
          // callbackSuccessUrl/callbackCancelUrl omis : Orange rejette supabase.co
          // Le suivi réel passe par X-Callback-Url (webhook, POST Orange → nous).
        }),
      })

      const omData = await omRes.json()
      if (!omRes.ok) {
        throw new Error(omData.message ?? omData.detail ?? JSON.stringify(omData))
      }

      paymentUrl = omData.deepLink ?? ''  // deep link → ouvre directement l'app OM
      qrCode     = omData.qrCode   ?? ''  // base64 : affiché si deep link non dispo
      // Pas de transaction ID côté Sonatel au moment de la création du QR.
      // Il arrivera dans la notification webhook (notification.transactionId).
    }

    // ⑨ Enregistrer la référence provider (id Wave ou sub.id pour OM)
    await admin
      .from('visibility_subscriptions')
      .update({ transaction_id: reference })
      .eq('id', sub.id)

    return json({
      status:         'pending_payment',
      subscriptionId: sub.id,
      paymentUrl,   // L'app fait Linking.openURL(paymentUrl) pour les deux méthodes
      qrCode,       // OM : fallback si deepLink ne s'ouvre pas (vide pour Wave)
      reference,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
