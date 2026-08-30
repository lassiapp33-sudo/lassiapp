import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
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
    const ghost = `deleted-${uid}@lassi.app`

    const check = (label: string, error: { message: string } | null) => {
      if (error) throw new Error(`${label}: ${error.message}`)
    }

    // ── 1. Nettoyage commun (toujours, avant toute décision) ─────────────────
    check('favorites',    (await admin.from('favorites').delete().eq('user_id', uid)).error)
    check('notifications',(await admin.from('notifications').delete().eq('user_id', uid)).error)
    check('disputes',     (await admin.from('disputes').delete().or(`reporter_id.eq.${uid},against_id.eq.${uid}`)).error)

    // ── 2. A-t-il un historique financier (payment_intents) ? ────────────────
    // payment_intents/payment_logs sont des registres immuables pour l'audit :
    // FK NOT NULL vers profiles sans cascade → impossible de supprimer le profil.
    // On anonymise le compte à la place.
    const { count: paymentCount, error: pcErr } = await admin
      .from('payment_intents')
      .select('id', { count: 'exact', head: true })
      .or(`client_id.eq.${uid},prestataire_id.eq.${uid}`)
    check('payment_intents(count)', pcErr)

    // ── Suppression de la boutique (dans les deux cas) ───────────────────────
    // Les payment_intents référencent client_id/prestataire_id (user IDs),
    // pas le shop → on peut supprimer le shop même avec historique financier.
    const { data: shopToDel } = await admin.from('shops').select('id').eq('merchant_id', uid).maybeSingle()
    if (shopToDel) {
      const { data: shopOrdersToDel } = await admin.from('orders').select('id').eq('shop_id', shopToDel.id)
      if (shopOrdersToDel?.length) {
        await admin.from('order_items').delete().in('order_id', shopOrdersToDel.map((o: any) => o.id))
        await admin.from('orders').delete().eq('shop_id', shopToDel.id)
      }
      const { data: debtsToDel } = await admin.from('debts').select('id').eq('shop_id', shopToDel.id)
      if (debtsToDel?.length) {
        await admin.from('debt_transactions').delete().in('debt_id', debtsToDel.map((d: any) => d.id))
      }
      await admin.from('debts').delete().eq('shop_id', shopToDel.id)
      await admin.from('terrains').delete().eq('prestataire_id', uid)
      await admin.from('products').delete().eq('shop_id', shopToDel.id)
      check('shops(delete)', (await admin.from('shops').delete().eq('id', shopToDel.id)).error)
    }

    if (paymentCount && paymentCount > 0) {
      // ── ANONYMISATION (historique financier conservé) ──────────────────────
      // Boutique déjà supprimée ci-dessus. On anonymise uniquement le profil
      // pour préserver la traçabilité financière.
      const { error: profErr } = await admin
        .from('profiles')
        .update({
          name: 'Compte supprimé',
          phone: null,
          email: ghost,
          auth_email: ghost,
          avatar_url: null,
        })
        .eq('id', uid)
      check('profiles(anonymize)', profErr)

      const { error: banError } = await admin.auth.admin.updateUserById(uid, {
        email: ghost,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: {},
        ban_duration: '876000h', // ~100 ans = permanent
      })
      if (banError) throw new Error(`auth(ban): ${banError.message}`)

    } else {
      // ── SUPPRESSION DÉFINITIVE (aucun historique financier) ───────────────

      // payout_queue : prestataire_id → auth.users sans CASCADE
      check('payout_queue',  (await admin.from('payout_queue').delete().eq('prestataire_id', uid)).error)

      // payments : client_id/prestataire_id → auth.users sans CASCADE
      check('payments(prestataire)', (await admin.from('payments').delete().eq('prestataire_id', uid)).error)
      check('payments(client)',       (await admin.from('payments').delete().eq('client_id', uid)).error)

      // Réservations terrain
      check('reservations_terrain',
        (await admin.from('reservations_terrain').delete().or(`client_id.eq.${uid},prestataire_id.eq.${uid}`)).error,
      )

      // Commandes client
      const { data: clientOrders, error: coErr } = await admin.from('orders').select('id').eq('client_id', uid)
      check('orders(client select)', coErr)
      if (clientOrders?.length) {
        check('order_items(client)',
          (await admin.from('order_items').delete().in('order_id', clientOrders.map((o: any) => o.id))).error,
        )
      }
      check('orders(client)', (await admin.from('orders').delete().eq('client_id', uid)).error)

      // Boutique déjà supprimée avant le if/else

      check('profiles(delete)', (await admin.from('profiles').delete().eq('id', uid)).error)

      const { error: deleteError } = await admin.auth.admin.deleteUser(uid)
      if (deleteError) throw new Error(`auth(delete): ${deleteError.message}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    const msg = err.message ?? String(err)
    console.error('[delete-account]', msg)
    // Renvoyer le message réel pour faciliter le débogage
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
