import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const fail = (msg: string, status = 400) =>
    new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return fail('Non authentifié', 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return fail('Session invalide', 401)

    const { shopId, items, orderType, note, payMethod } = await req.json()

    if (!shopId || !Array.isArray(items) || items.length === 0) {
      return fail('Paramètres manquants')
    }

    // Vérifier que le shop est bien un profil VIP actif
    const { data: vipProfil } = await admin
      .from('vip_profils')
      .select('id')
      .eq('shop_id', shopId)
      .eq('actif', true)
      .maybeSingle()

    if (!vipProfil) return fail('Boutique non enregistrée comme 5 Étoiles')

    // Récupérer les vraies prestations depuis vip_prestations (jamais faire confiance au client)
    const prestationIds = items.map((i: { prestationId: string; qty: number }) => i.prestationId)

    const { data: prestations, error: prestErr } = await admin
      .from('vip_prestations')
      .select('id, nom, prix, disponible')
      .in('id', prestationIds)
      .eq('vip_profil_id', vipProfil.id)

    if (prestErr) throw new Error(prestErr.message)
    if (!prestations || prestations.length !== prestationIds.length) {
      return fail('Certaines prestations sont introuvables')
    }

    const epuisees = prestations.filter((p: { disponible: boolean }) => !p.disponible)
    if (epuisees.length > 0) {
      return fail(`Prestations épuisées : ${epuisees.map((p: { nom: string }) => p.nom).join(', ')}`)
    }

    // Recalculer le total côté serveur — prix venant de vip_prestations uniquement
    const priceMap = Object.fromEntries(
      prestations.map((p: { id: string; nom: string; prix: number }) => [p.id, { nom: p.nom, prix: p.prix }])
    )

    let total = 0
    const orderItems: { product_name: string; qty: number; unit_price: number }[] = []

    for (const item of items as { prestationId: string; qty: number }[]) {
      const p = priceMap[item.prestationId]
      if (!p) return fail('Prestation invalide')
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return fail('Quantité invalide (1–99)')
      }
      total += p.prix * item.qty
      orderItems.push({ product_name: p.nom, qty: item.qty, unit_price: p.prix })
    }

    // Nom du client
    const { data: profile } = await admin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    // Créer la commande via create_order_atomic (items en texte libre, pas de productId)
    const safePayMethod = ['wave', 'om', 'cash'].includes(payMethod) ? payMethod : 'wave'

    const { data: orderResult, error: orderErr } = await admin.rpc('create_order_atomic', {
      p_shop_id:         shopId,
      p_client_id:       user.id,
      p_client_name:     profile?.name ?? 'Client',
      p_total:           total,
      p_discount_amount: 0,
      p_promo_label:     null,
      p_order_type:      orderType ?? 'emporter',
      p_note:            note?.trim()?.slice(0, 300) ?? null,
      p_idempotency_key: null,
      p_items:           orderItems,
      p_pay_method:      safePayMethod,
    })

    if (orderErr) throw new Error(orderErr.message)

    return new Response(
      JSON.stringify({ orderId: orderResult.id, total }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
