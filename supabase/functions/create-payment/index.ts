import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? ''
const WAVE_MERCHANT_ID = Deno.env.get('WAVE_MERCHANT_ID') ?? ''
const OM_API_KEY       = Deno.env.get('OM_API_KEY')       ?? ''
const OM_MERCHANT_ID   = Deno.env.get('OM_MERCHANT_ID')   ?? ''
const APP_BASE_URL     = Deno.env.get('APP_BASE_URL')     ?? 'lassi://'

const KEYS_READY = {
  wave:         !!(WAVE_API_KEY && WAVE_MERCHANT_ID),
  orange_money: !!(OM_API_KEY   && OM_MERCHANT_ID),
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // GET : expose la disponibilité des clés
  if (req.method === 'GET') {
    return json({ wave: KEYS_READY.wave, orange_money: KEYS_READY.orange_money })
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    const { ticketId, amount, method, merchantName } = await req.json()
    if (!ticketId || !amount || !method) {
      return json({ error: 'ticketId, amount et method requis' }, 400)
    }

    // 'om' (alias client) → 'orange_money' (clé interne)
    const methodKey = method === 'om' ? 'orange_money' : method as 'wave' | 'orange_money'

    if (!KEYS_READY[methodKey]) {
      return json({
        status:  'awaiting_keys',
        message: 'Le paiement mobile est en cours d\'intégration. Revenez bientôt !',
      })
    }

    let paymentUrl = ''
    let reference  = ticketId

    if (methodKey === 'wave') {
      const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${WAVE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency:         'XOF',
          amount:           String(amount),
          merchant_id:      WAVE_MERCHANT_ID,
          success_url:      `${APP_BASE_URL}/payment-success?ref=${encodeURIComponent(ticketId)}`,
          error_url:        `${APP_BASE_URL}/payment-error?ref=${encodeURIComponent(ticketId)}`,
          client_reference: ticketId,
        }),
      })
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')
      paymentUrl = waveData.wave_launch_url ?? ''
      reference  = waveData.id ?? ticketId

    } else {
      const omRes = await fetch(
        'https://api.orange.com/orange-money-webpay/sn/v1/webpayment',
        {
          method:  'POST',
          headers: {
            Authorization: `Bearer ${OM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchant_key: OM_MERCHANT_ID,
            currency:     'OUV',
            order_id:     ticketId,
            amount,
            return_url:   `${APP_BASE_URL}/payment-success`,
            cancel_url:   `${APP_BASE_URL}/payment-error`,
            notif_url:    `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-payment`,
          }),
        },
      )
      const omData = await omRes.json()
      if (!omRes.ok) throw new Error(omData.message ?? 'Erreur Orange Money')
      paymentUrl = omData.payment_url ?? ''
      reference  = omData.pay_token ?? ticketId
    }

    return json({ paymentUrl, reference })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
