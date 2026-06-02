import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const uid = user.id

    await admin.from('favorites').delete().eq('user_id', uid)

    const { data: clientOrders } = await admin.from('orders').select('id').eq('client_id', uid)
    if (clientOrders?.length) {
      await admin.from('order_items').delete().in('order_id', clientOrders.map(o => o.id))
    }
    await admin.from('orders').delete().eq('client_id', uid)

    const { data: shop } = await admin.from('shops').select('id').eq('merchant_id', uid).maybeSingle()

    if (shop) {
      const { data: shopOrders } = await admin.from('orders').select('id').eq('shop_id', shop.id)
      if (shopOrders?.length) {
        await admin.from('order_items').delete().in('order_id', shopOrders.map(o => o.id))
      }
      await admin.from('orders').delete().eq('shop_id', shop.id)

      const { data: debts } = await admin.from('debts').select('id').eq('shop_id', shop.id)
      if (debts?.length) {
        await admin.from('debt_transactions').delete().in('debt_id', debts.map(d => d.id))
      }
      await admin.from('debts').delete().eq('shop_id', shop.id)
      await admin.from('products').delete().eq('shop_id', shop.id)
      await admin.from('shops').delete().eq('id', shop.id)
    }

    await admin.from('profiles').delete().eq('id', uid)

    const { error: deleteError } = await admin.auth.admin.deleteUser(uid)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
