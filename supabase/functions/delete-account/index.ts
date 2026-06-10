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

    // Lève une erreur explicite (table + message Postgres) au lieu d'échouer
    // silencieusement plus loin avec "Database error deleting user".
    const check = (label: string, error: { message: string } | null) => {
      if (error) throw new Error(`${label}: ${error.message}`)
    }

    // ── 1. Données non sensibles, toujours supprimables ──────────────────────
    check('favorites', (await admin.from('favorites').delete().eq('user_id', uid)).error)

    // Litiges où l'utilisateur est impliqué (cascade -> dispute_messages)
    check(
      'disputes',
      (await admin.from('disputes').delete().or(`reporter_id.eq.${uid},against_id.eq.${uid}`)).error,
    )

    // ── 2. A-t-il un historique financier (payment_intents) ? ────────────────
    // payment_intents/payment_logs sont des registres financiers immuables
    // (règle SQL "DO INSTEAD NOTHING" sur DELETE/UPDATE de payment_logs) avec
    // FK NOT NULL vers profiles(id) sans cascade. Si une ligne existe, la
    // suppression définitive du profil/auth.users est impossible (et ne doit
    // pas l'être pour des raisons d'audit). On anonymise à la place.
    const { count: paymentCount, error: pcErr } = await admin
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .or(`client_id.eq.${uid},prestataire_id.eq.${uid}`)
    check('payment_intents(count)', pcErr)

    if (paymentCount && paymentCount > 0) {
      // ── Anonymisation (historique financier conservé pour l'audit) ─────────
      check(
        'profiles(anonymize)',
        (await admin
          .from('profiles')
          .update({
            name: 'Compte supprimé',
            phone: null,
            email: null,
            auth_email: null,
            avatar_url: null,
          })
          .eq('id', uid)).error,
      )

      const { error: banError } = await admin.auth.admin.updateUserById(uid, {
        email: `deleted-${uid}@lassi.app`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: {},
        ban_duration: '876000h', // ~100 ans = permanent
      })
      if (banError) throw banError
    } else {
      // ── Suppression définitive (aucun historique financier) ────────────────

      // Réservations terrain (client + prestataire) avant orders/profiles
      check(
        'reservations_terrain',
        (await admin.from('reservations_terrain').delete().or(`client_id.eq.${uid},prestataire_id.eq.${uid}`)).error,
      )

      // Commandes passées en tant que client
      const { data: clientOrders, error: coErr } = await admin.from('orders').select('id').eq('client_id', uid)
      check('orders(client select)', coErr)
      if (clientOrders?.length) {
        check(
          'order_items(client)',
          (await admin.from('order_items').delete().in('order_id', clientOrders.map(o => o.id))).error,
        )
      }
      check('orders(client)', (await admin.from('orders').delete().eq('client_id', uid)).error)

      // Boutique (si marchand)
      const { data: shop, error: shopSelErr } = await admin.from('shops').select('id').eq('merchant_id', uid).maybeSingle()
      check('shops(select)', shopSelErr)

      if (shop) {
        const { data: shopOrders, error: soErr } = await admin.from('orders').select('id').eq('shop_id', shop.id)
        check('orders(shop select)', soErr)
        if (shopOrders?.length) {
          check(
            'order_items(shop)',
            (await admin.from('order_items').delete().in('order_id', shopOrders.map(o => o.id))).error,
          )
        }
        check('orders(shop)', (await admin.from('orders').delete().eq('shop_id', shop.id)).error)

        const { data: debts, error: dErr } = await admin.from('debts').select('id').eq('shop_id', shop.id)
        check('debts(select)', dErr)
        if (debts?.length) {
          check(
            'debt_transactions',
            (await admin.from('debt_transactions').delete().in('debt_id', debts.map(d => d.id))).error,
          )
        }
        check('debts', (await admin.from('debts').delete().eq('shop_id', shop.id)).error)

        check('terrains', (await admin.from('terrains').delete().eq('prestataire_id', uid)).error)
        check('products', (await admin.from('products').delete().eq('shop_id', shop.id)).error)
        check('shops', (await admin.from('shops').delete().eq('id', shop.id)).error)
      }

      check('profiles(delete)', (await admin.from('profiles').delete().eq('id', uid)).error)

      const { error: deleteError } = await admin.auth.admin.deleteUser(uid)
      if (deleteError) throw deleteError
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
