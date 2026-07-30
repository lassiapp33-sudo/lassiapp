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
    const subIdRaw = url.searchParams.get('sub_id') ?? ''
    // Valider UUID avant injection dans HTML (protection XSS)
    const subId = isUUID(subIdRaw) ? subIdRaw : ''
    const deepLink = result === 'success'
      ? `lassiapp://visibility-success?sub=${encodeURIComponent(subId)}`
      : `lassiapp://visibility-error?sub=${encodeURIComponent(subId)}`
    const deepLinkEncoded = deepLink.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${deepLinkEncoded}">
<title>LASSI — Redirection</title></head><body>
<p>Redirection vers l'application LASSI...</p>
<a href="${deepLinkEncoded}">Ouvrir LASSI</a>
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

    // Secret obligatoire — jamais de fallback permissif sur un endpoint financier
    if (!OM_WEBHOOK_SECRET) {
      console.error('OM webhook: OM_WEBHOOK_SECRET non configuré — webhook désactivé par sécurité')
      return json({ error: 'Configuration manquante' }, 503)
    }
    if (secret !== OM_WEBHOOK_SECRET) {
      console.error('OM webhook: secret invalide')
      return json({ error: 'Non autorisé' }, 401)
    }

    // ② Parser la notification Orange Money
    // 400 (pas de retry) si JSON malformé, 500 (retry) si erreur serveur
    let notification: OmNotification
    try {
      notification = await req.json() as OmNotification
    } catch {
      console.error('OM webhook: body JSON invalide — pas de retry')
      return json({ error: 'Body invalide' }, 400)
    }
    console.log('OM webhook reçu:', JSON.stringify({ subId, status: notification.status, transactionId: notification.transactionId }))

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Charger l'abonnement — SELECT explicite sans FK join (plan_id peut être NULL pour annonce)
    const { data: sub, error: subFetchError } = await admin
      .from('visibility_subscriptions')
      .select('id, shop_id, merchant_id, status, offer_type, amount, plan_id, plan_duration_days, product_ids, product_id, all_products, transaction_id, metadata')
      .eq('id', subId)
      .maybeSingle()

    if (subFetchError) {
      console.error('OM webhook: erreur SELECT abonnement —', subId, JSON.stringify(subFetchError))
      return json({ error: 'Erreur lecture abonnement' }, 500)
    }
    if (!sub) {
      console.error('OM webhook: abonnement introuvable —', subId)
      return json({ error: 'Abonnement introuvable' }, 404)
    }

    // Charger le label du plan séparément (seulement si plan_id non null)
    let planLabel = ''
    let planDurationFromPlan: number | null = null
    if (sub.plan_id) {
      const { data: plan } = await admin
        .from('visibility_plans')
        .select('label, duration_days')
        .eq('id', sub.plan_id)
        .maybeSingle()
      planLabel = plan?.label ?? ''
      planDurationFromPlan = plan?.duration_days ?? null
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
    // Accepter toutes les variantes success courantes de l'API Sonatel
    const successStatuses = new Set(['SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED'])
    if (!successStatuses.has((notification.status ?? '').toUpperCase())) {
      console.log('OM webhook: statut non-SUCCESS ignoré —', notification.status)
      return json({ received: true })
    }

    // ⑤ Vérifier que le montant reçu correspond au montant attendu (au centime près)
    const receivedAmount = notification.amount?.value !== undefined
      ? Math.round(Number(notification.amount.value))
      : null

    if (receivedAmount === null) {
      console.error('OM webhook: montant absent dans la notification —', subId)
      await admin.from('visibility_subscriptions')
        .update({ status: 'failed' })
        .eq('id', subId)
        .eq('status', 'pending')
      return json({ received: true })
    }

    const expectedAmount = Math.round(Number(sub.amount))
    if (receivedAmount !== expectedAmount) {
      console.error('[ALERTE PAIEMENT] montant incohérent — sub', subId,
        { reçu: receivedAmount, attendu: expectedAmount })
      await admin.from('visibility_subscriptions')
        .update({ status: 'failed' })
        .eq('id', subId)
        .eq('status', 'pending')
      // Log d'audit pour investigation
      await admin.from('payment_logs').insert({
        payment_intent_id: null,
        event_type: 'visibility_amount_mismatch',
        event_data: {
          subscription_id: subId,
          received: receivedAmount,
          expected: expectedAmount,
          transaction_id: notification.transactionId,
        },
      }).catch(() => null)
      return json({ received: true })
    }

    // ⑥ Montant vérifié → activer l'abonnement
    const durationDays: number = sub.plan_duration_days ?? planDurationFromPlan ?? 30
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      console.error('OM webhook: durationDays invalide —', durationDays, 'pour sub', subId)
      return json({ error: 'Configuration forfait invalide' }, 500)
    }
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

    // ⑦ Activer l'offre selon le type
    const offerType: string = sub.offer_type ?? 'quartier'

    if (offerType === 'recherche') {
      const { error: rpcError } = await admin.rpc('grant_recherche_boost', {
        p_shop_id: sub.shop_id,
        p_days: durationDays,
      })
      if (rpcError) throw rpcError
    } else if (offerType === 'carte') {
      const { error: rpcError } = await admin.rpc('grant_carte_pin', {
        p_shop_id: sub.shop_id,
        p_days: durationDays,
      })
      if (rpcError) throw rpcError
    } else if (offerType === 'annonce') {
      // Annonce sponsorisée payée en OM/Wave : créer l'annonce directement
      // (pas d'intermédiaire crédit — le paiement OM/Wave finance l'annonce directement)
      const meta = sub.metadata as {
        format: string
        titre?: string | null
        corps?: string | null
        imageUrl?: string | null
        durationHours: number
        estMin: number
        estMax: number
      } | null

      if (!meta || !meta.format || !meta.durationHours) {
        // Fallback : si pas de metadata (test manuel), juste créditer
        console.warn('OM webhook annonce: metadata absente — fallback crédit uniquement')
        const creditsToAdd = Math.round(Number(sub.amount))
        const { error: creditError } = await admin.rpc('increment_shop_credit', {
          p_shop_id: sub.shop_id,
          p_amount: creditsToAdd,
        })
        if (creditError) throw creditError
      } else {
        const adExpiresAt = new Date(Date.now() + meta.durationHours * 3_600_000).toISOString()
        const { error: adError } = await admin
          .from('sponsored_ads')
          .insert({
            shop_id:              sub.shop_id,
            merchant_id:          sub.merchant_id,
            format:               meta.format,
            titre:                meta.titre ?? null,
            corps:                meta.corps ?? null,
            image_url:            meta.imageUrl ?? null,
            budget_credits:       Math.round(Number(sub.amount)),
            duration_hours:       meta.durationHours,
            estimated_views_min:  meta.estMin,
            estimated_views_max:  meta.estMax,
            expires_at:           adExpiresAt,
            status:               'active',
          })
        if (adError) throw adError
        console.log('OM webhook annonce: annonce créée pour shop', sub.shop_id, 'expire', adExpiresAt)
      }
    } else {
      // quartier : mise en avant des produits
      await admin
        .from('shops')
        .update({
          is_featured:           true,
          featured_product_id:   sub.all_products ? null : (sub.product_ids?.[0] ?? sub.product_id ?? null),
          featured_product_ids:  sub.all_products ? [] : (sub.product_ids ?? []),
          featured_all_products: !!sub.all_products,
        })
        .eq('id', sub.shop_id)

      // Alimenter le carrousel "Offre du Quartier" (best-effort)
      const paidProductIds: string[] = sub.all_products ? [] : (sub.product_ids ?? [])
      if (paidProductIds.length > 0) {
        const { data: prodDetails } = await admin
          .from('products')
          .select('id, name, price, emoji, photo_url')
          .in('id', paidProductIds)

        if (prodDetails && prodDetails.length > 0) {
          await admin.from('carrousel_offre_quartier').delete()
            .eq('prestataire_id', sub.merchant_id).eq('is_paid_pack', true)

          const rows = paidProductIds
            .map((id: string, index: number) => {
              const p = prodDetails.find((pr: { id: string }) => pr.id === id)
              if (!p) return null
              const imageUrl =
                typeof (p as { photo_url?: string }).photo_url === 'string' &&
                (p as { photo_url: string }).photo_url.startsWith('http')
                  ? (p as { photo_url: string }).photo_url
                  : ((p as { emoji?: string }).emoji ?? '')
              return {
                prestataire_id:   sub.merchant_id,
                product_id:       id,
                nom:              (p as { name: string }).name,
                prix:             (p as { price: number }).price,
                image_url:        imageUrl,
                rang_prestataire: null,
                ordre:            index,
                periode:          'paid',
                est_actif:        true,
                is_paid_pack:     true,
              }
            })
            .filter(Boolean)

          if (rows.length > 0) {
            await admin.from('carrousel_offre_quartier').insert(rows).catch(() => null)
          }
        }
      }
    }

    // ⑧ Notification in-app au marchand
    const expiryFr = expiresAt.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const amountFCFA = (sub.amount as number)?.toLocaleString('fr-FR') ?? ''

    const OFFER_LABELS: Record<string, string> = {
      quartier:  "l'Offre du Quartier",
      recherche: 'Booster recherche',
      carte:     'Épingle dorée (carte)',
      annonce:   'Annonce Sponsorisée',
    }
    const offerLabel = OFFER_LABELS[offerType] ?? offerType

    const notifBody = offerType === 'annonce'
      ? `Votre paiement de ${amountFCFA} FCFA a été reçu et votre annonce sponsorisée est maintenant en ligne. Bonne visibilité !`
      : `Grâce à votre achat du forfait « ${planLabel} » (${amountFCFA} FCFA), ` +
        `vous avez activé ${offerLabel} jusqu'au ${expiryFr}. ` +
        `Profitez-en pour attirer encore plus de clients !`

    await admin.from('notifications').insert({
      user_id: sub.merchant_id,
      type:    'vip',
      title:   '🎉 Félicitations pour votre achat',
      body:    notifBody,
      data:    { subscription_id: sub.id, offer_type: offerType },
    })

    console.log('OM webhook: abonnement activé —', subId, 'expires', expiresAt.toISOString())
    return json({ received: true })

  } catch (err: unknown) {
    let msg = 'Erreur interne'
    if (err instanceof Error) {
      msg = err.message
    } else if (err != null && typeof err === 'object' && 'message' in err) {
      msg = String((err as { message: unknown }).message)
    }
    console.error('OM webhook erreur:', msg, JSON.stringify(err))
    // Retourner 500 pour qu'Orange retry (elle réessaie sur 5xx)
    return json({ error: msg }, 500)
  }
})
