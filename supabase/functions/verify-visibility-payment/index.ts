import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Clés API ─────────────────────────────────────────────────────────────────
// Mêmes variables que create-visibility-payment.
// TODO: vérifier que WAVE_SECRET_KEY et OM_API_KEY sont configurés avant mise en prod.

const WAVE_SECRET_KEY = Deno.env.get('WAVE_SECRET_KEY') ?? ''  // clé pour vérifier le statut
const OM_API_KEY      = Deno.env.get('OM_API_KEY')      ?? ''

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ① Authentification
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    const { subscriptionId } = await req.json()
    if (!subscriptionId) return json({ error: 'subscriptionId requis' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ② Charger l'abonnement — vérifier qu'il appartient au caller
    const { data: sub } = await admin
      .from('visibility_subscriptions')
      .select('*, plan:plan_id(duration_days, label)')
      .eq('id', subscriptionId)
      .eq('merchant_id', user.id)
      .maybeSingle()

    if (!sub) return json({ error: 'Abonnement introuvable' }, 404)

    // Déjà actif → idempotent
    if (sub.status === 'active') {
      return json({ paid: true, status: 'active', expiresAt: sub.expires_at })
    }

    if (sub.status !== 'pending') {
      return json({ paid: false, status: sub.status })
    }

    // ③ Vérifier le paiement côté API fournisseur
    let paid = false

    if (sub.pay_method === 'wave' && WAVE_SECRET_KEY) {
      // ── Wave : vérification du statut de la session de paiement ───────────
      // Doc: https://docs.wave.com/business/checkout#retrieve-a-checkout-session
      const res  = await fetch(
        `https://api.wave.com/v1/checkout/sessions/${sub.transaction_id}`,
        { headers: { Authorization: `Bearer ${WAVE_SECRET_KEY}` } },
      )
      const data = await res.json()
      paid = data.payment_status === 'succeeded'

    } else if (sub.pay_method === 'orange_money' && OM_API_KEY) {
      // ── Orange Money : vérification du statut de la transaction ───────────
      // Doc: https://developer.orange.com/apis/orange-money-webpay-sn
      const res  = await fetch(
        'https://api.orange.com/orange-money-webpay/sn/v1/transactionstatus',
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${OM_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: sub.id }),
        },
      )
      const data = await res.json()
      paid = data.status === 'SUCCESS'

    } else {
      // Clés non configurées
      return json({ paid: false, status: 'awaiting_keys' })
    }

    if (!paid) return json({ paid: false, status: 'pending' })

    // ④ Paiement confirmé → activer l'abonnement
    const now       = new Date()
    const startedAt = now.toISOString()
    const expiresAt = new Date(now.getTime() + sub.plan.duration_days * 86_400_000)

    const { error: updateError } = await admin
      .from('visibility_subscriptions')
      .update({
        status:     'active',
        started_at: startedAt,
        expires_at: expiresAt.toISOString(),
        paid_at:    startedAt,
      })
      .eq('id', sub.id)

    if (updateError) throw updateError

    // ⑤ Activer "Offre du quartier" pour la boutique avec le produit choisi
    await admin
      .from('shops')
      .update({
        is_featured:         true,
        featured_product_id: sub.product_id,
      })
      .eq('id', sub.shop_id)

    // ⑥ Notification in-app au marchand
    const expiryFr = expiresAt.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    await admin.from('notifications').insert({
      user_id: user.id,
      type:    'visibility',
      title:   'Offre du quartier activée ✅',
      body:    `Ton forfait ${sub.plan.label} est actif jusqu'au ${expiryFr}.`,
      data:    { subscription_id: sub.id },
    })

    return json({ paid: true, status: 'active', expiresAt: expiresAt.toISOString() })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
