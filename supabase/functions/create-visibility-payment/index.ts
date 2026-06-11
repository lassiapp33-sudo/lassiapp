import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString, isBoolean } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

const PLAN_ID_RE = /^[a-z0-9]+$/i
const MAX_FEATURED_PRODUCTS = 50

// ─── Clés API de paiement ─────────────────────────────────────────────────────
// TODO: remplir ces variables dans le dashboard Supabase
//       Settings → Edge Functions → Secrets
//       (ou dans supabase/functions/.env pour le développement local)
//
// Variables attendues :
//   WAVE_API_KEY       = <clé secrète Wave Checkout>
//   WAVE_MERCHANT_ID   = <identifiant marchand Wave>
//   OM_API_KEY         = <token Orange Money WebPay>
//   OM_MERCHANT_ID     = <merchant_key Orange Money>
//   APP_BASE_URL       = <URL de callback deep-link, ex: lassi://payment>

const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? ''
const WAVE_MERCHANT_ID = Deno.env.get('WAVE_MERCHANT_ID') ?? ''
const OM_API_KEY       = Deno.env.get('OM_API_KEY')       ?? ''
const OM_MERCHANT_ID   = Deno.env.get('OM_MERCHANT_ID')   ?? ''
const APP_BASE_URL     = Deno.env.get('APP_BASE_URL')     ?? ''

const KEYS_READY = {
  wave:         !!(WAVE_API_KEY && WAVE_MERCHANT_ID),
  orange_money: !!(OM_API_KEY   && OM_MERCHANT_ID),
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

  // GET : expose la disponibilité des clés (appelé par l'app au chargement de l'écran)
  if (req.method === 'GET') {
    return json({ wave: KEYS_READY.wave, orange_money: KEYS_READY.orange_money })
  }

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

    // ③ Si les clés API ne sont pas encore configurées → refuser proprement
    //    sans créer de ligne en base (évite les lignes orphelines)
    if (!KEYS_READY[payMethod as keyof typeof KEYS_READY]) {
      return json({
        status:  'awaiting_keys',
        message: 'Le paiement mobile est en cours d\'intégration. Revenez bientôt !',
      })
    }

    // ④ Vérifier que l'utilisateur possède bien une boutique
    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', user.id)
      .maybeSingle()

    if (!shop) return json({ error: 'Boutique introuvable' }, 404)

    // ⑤ Charger le forfait depuis la DB — prix officiel côté serveur
    //    (on n'accepte jamais un prix envoyé par le client)
    const { data: plan } = await admin
      .from('visibility_plans')
      .select('id, label, price, duration_months, duration_days')
      .eq('id', planId)
      .eq('active', true)
      .maybeSingle()

    if (!plan) return json({ error: 'Forfait introuvable ou inactif' }, 404)

    // ⑤bis Vérifier que les produits choisis appartiennent bien à cette boutique
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

    // ⑥ Vérifier l'absence d'un abonnement déjà actif
    const now = new Date().toISOString()
    const { data: existing } = await admin
      .from('visibility_subscriptions')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle()

    if (existing) return json({ error: 'Un abonnement actif existe déjà' }, 409)

    // ⑦ Créer la ligne pending (avant l'appel API pour avoir l'ID de référence)
    const { data: sub, error: subError } = await admin
      .from('visibility_subscriptions')
      .insert({
        shop_id:      shop.id,
        merchant_id:  user.id,
        plan_id:      plan.id,
        product_id:   featuredProductIds[0] ?? null,  // legacy : 1er produit pour affichage simple
        product_ids:  featuredProductIds,
        all_products: wantsAllProducts,
        amount:       plan.price,  // prix chargé depuis la DB, pas depuis le client
        pay_method:   payMethod,
        status:       'pending',
      })
      .select()
      .single()

    if (subError) throw subError

    // ⑧ Appel à l'API Wave ou Orange Money pour créer la session de paiement
    let paymentUrl = ''
    let reference  = sub.id  // sera remplacé par l'ID du provider

    if (payMethod === 'wave') {
      // ── Wave Checkout ──────────────────────────────────────────────────────
      // Doc: https://docs.wave.com/business/checkout
      const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${WAVE_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          currency:         'XOF',
          amount:           String(plan.price),
          merchant_id:      WAVE_MERCHANT_ID,
          success_url:      `${APP_BASE_URL}/visibility-success?sub=${sub.id}`,
          error_url:        `${APP_BASE_URL}/visibility-error?sub=${sub.id}`,
          client_reference: sub.id,
        }),
      })
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')
      paymentUrl = waveData.wave_launch_url ?? ''
      reference  = waveData.id ?? sub.id

    } else {
      // ── Orange Money WebPay ────────────────────────────────────────────────
      // Doc: https://developer.orange.com/apis/orange-money-webpay-sn
      const omRes = await fetch(
        'https://api.orange.com/orange-money-webpay/sn/v1/webpayment',
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${OM_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            merchant_key: OM_MERCHANT_ID,
            currency:     'OUV',
            order_id:     sub.id,
            amount:       plan.price,
            return_url:   `${APP_BASE_URL}/visibility-success`,
            cancel_url:   `${APP_BASE_URL}/visibility-error`,
            notif_url:    `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-visibility-payment`,
          }),
        },
      )
      const omData = await omRes.json()
      if (!omRes.ok) throw new Error(omData.message ?? 'Erreur Orange Money')
      paymentUrl = omData.payment_url ?? ''
      reference  = omData.pay_token ?? sub.id
    }

    // ⑨ Enregistrer la référence du provider en base
    await admin
      .from('visibility_subscriptions')
      .update({ transaction_id: reference })
      .eq('id', sub.id)

    return json({
      status:         'pending_payment',
      subscriptionId: sub.id,
      paymentUrl,
      reference,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
