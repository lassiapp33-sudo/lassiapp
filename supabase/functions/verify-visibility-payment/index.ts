import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'

const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''

// Notification POST par Orange Money Sonatel après paiement QR code.
// Doc: https://api.sandbox.orange-sonatel.com → /api/eWallet/v4/qrcode callback
interface OmNotification {
  amount:         { value: number; unit: string }
  partner:        { idType: string; id: string }        // id = OM_MERCHANT_CODE
  customer?:      { idType: string; id: string }        // id = msisdn du payeur
  reference?:     string
  type?:          string                                // "MERCHANT_PAYMENT"
  channel?:       string                                // "API"
  transactionId?: string                                // ex: "MP220928.1029.C58502"
  paymentMethod?: string                                // "QRCODE"
  status:         'SUCCESS' | 'FAILED' | string
}

Deno.serve(async (req) => {
  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // OPTIONS / HEAD : validation de l'URL par Orange avant d'accepter le callback
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    return new Response(null, { status: 200 })
  }

  // ── GET : redirect navigateur après paiement Orange (callbackSuccessUrl/Cancel) ──
  if (req.method === 'GET') {
    const url    = new URL(req.url)
    const result = url.searchParams.get('result') ?? 'cancel'
    const subId  = url.searchParams.get('sub_id') ?? ''
    const deepLink = result === 'success'
      ? `lassiapp://visibility-success?sub=${subId}`
      : `lassiapp://visibility-error?sub=${subId}`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${deepLink}">
<title>LASSI — Redirection</title></head><body>
<p>Redirection vers l'application LASSI...</p>
<a href="${deepLink}">Ouvrir LASSI</a>
</body></html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Orange Money ne POST que cette URL — pas de CORS
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ① Extraire sub_id + secret depuis l'URL (mis en place dans create-visibility-payment)
    //    Format: /verify-visibility-payment?sub_id=<uuid>&secret=<OM_WEBHOOK_SECRET>
    const url    = new URL(req.url)
    const subId  = url.searchParams.get('sub_id') ?? ''
    const secret = url.searchParams.get('secret') ?? ''

    if (!subId || !isUUID(subId)) {
      console.error('OM webhook: sub_id invalide —', subId)
      return json({ error: 'sub_id invalide' }, 400)
    }

    // Secret obligatoire en production (OM_WEBHOOK_SECRET != '')
    if (OM_WEBHOOK_SECRET && secret !== OM_WEBHOOK_SECRET) {
      console.error('OM webhook: secret invalide')
      return json({ error: 'Non autorisé' }, 401)
    }

    // ② Parser la notification Orange Money
    const notification = await req.json() as OmNotification
    console.log('OM webhook reçu:', JSON.stringify({ subId, status: notification.status, transactionId: notification.transactionId }))

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Charger l'abonnement avec le plan associé
    const { data: sub } = await admin
      .from('visibility_subscriptions')
      .select('*, plan:plan_id(duration_days, label)')
      .eq('id', subId)
      .maybeSingle()

    if (!sub) {
      console.error('OM webhook: abonnement introuvable —', subId)
      return json({ error: 'Abonnement introuvable' }, 404)
    }

    // Idempotent : déjà traité
    if (sub.status === 'active') return json({ received: true })

    // ④ Traitement selon le statut Orange Money
    if (notification.status === 'FAILED') {
      await admin
        .from('visibility_subscriptions')
        .update({ status: 'failed' })
        .eq('id', subId)
        .eq('status', 'pending')  // garde contre race condition
      console.log('OM webhook: paiement FAILED —', subId)
      return json({ received: true })
    }

    // Statuts intermédiaires ignorés (Orange peut envoyer PENDING avant SUCCESS)
    if (notification.status !== 'SUCCESS') {
      console.log('OM webhook: statut intermédiaire ignoré —', notification.status)
      return json({ received: true })
    }

    // ⑤ Paiement SUCCESS → activer l'abonnement
    const durationDays: number = sub.plan?.duration_days ?? 30
    const now       = new Date()
    const expiresAt = new Date(now.getTime() + durationDays * 86_400_000)

    const { error: updateError } = await admin
      .from('visibility_subscriptions')
      .update({
        status:         'active',
        started_at:     now.toISOString(),
        expires_at:     expiresAt.toISOString(),
        paid_at:        now.toISOString(),
        transaction_id: notification.transactionId ?? sub.transaction_id,
      })
      .eq('id', subId)
      .eq('status', 'pending')  // garde contre double activation

    if (updateError) throw updateError

    // ⑥ Activer "Offre du quartier" sur la boutique
    await admin
      .from('shops')
      .update({
        is_featured:           true,
        featured_product_id:   sub.all_products ? null : (sub.product_ids?.[0] ?? sub.product_id ?? null),
        featured_product_ids:  sub.all_products ? [] : (sub.product_ids ?? []),
        featured_all_products: !!sub.all_products,
      })
      .eq('id', sub.shop_id)

    // ⑦ Notification in-app au marchand
    const expiryFr = expiresAt.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const planLabel  = sub.plan?.label ?? ''
    const amountFCFA = (sub.amount as number)?.toLocaleString('fr-FR') ?? ''

    await admin.from('notifications').insert({
      user_id: sub.merchant_id,
      type:    'vip',
      title:   '🎉 Félicitations pour votre achat !',
      body:    `Grâce à votre achat du forfait « ${planLabel} » (${amountFCFA} FCFA), ` +
               `vous avez obtenu une mise en avant de votre boutique dans l'Offre du Quartier ` +
               `jusqu'au ${expiryFr}. Profitez-en pour attirer encore plus de clients !`,
      data:    { subscription_id: sub.id },
    })

    console.log('OM webhook: abonnement activé —', subId, 'expires', expiresAt.toISOString())
    return json({ received: true })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('OM webhook erreur:', msg)
    // Retourner 500 pour qu'Orange retry (elle réessaie sur 5xx)
    return json({ error: msg }, 500)
  }
})
