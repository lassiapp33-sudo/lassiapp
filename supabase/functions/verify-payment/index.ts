import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WAVE_SECRET_KEY = Deno.env.get('WAVE_SECRET_KEY') ?? ''
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
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    const { reference, method } = await req.json()
    if (!reference || !method) {
      return json({ error: 'reference et method requis' }, 400)
    }

    // 'om' (alias client) → 'orange_money' (clé interne)
    const methodKey = method === 'om' ? 'orange_money' : method as 'wave' | 'orange_money'

    let paid = false

    if (methodKey === 'wave' && WAVE_SECRET_KEY) {
      const res  = await fetch(
        `https://api.wave.com/v1/checkout/sessions/${reference}`,
        { headers: { Authorization: `Bearer ${WAVE_SECRET_KEY}` } },
      )
      const data = await res.json()
      paid = data.payment_status === 'succeeded'

    } else if (methodKey === 'orange_money' && OM_API_KEY) {
      const res = await fetch(
        'https://api.orange.com/orange-money-webpay/sn/v1/transactionstatus',
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${OM_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: reference }),
        },
      )
      const data = await res.json()
      paid = data.status === 'SUCCESS'

    } else {
      // Clés non configurées — dev/test : paiement non confirmé
      return json({ paid: false, status: 'awaiting_keys' })
    }

    return json({ paid })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    return json({ error: msg }, 500)
  }
})
