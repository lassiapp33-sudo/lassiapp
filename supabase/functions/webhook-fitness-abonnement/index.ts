// ============================================================
// EDGE FUNCTION : webhook-fitness-abonnement
// Reçoit les notifications OM après paiement d'un abonnement fitness.
// Pour Wave : la vérification est faite via verify-fitness-payment.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''

// Mêmes statuts que webhook-payment — OM peut envoyer plusieurs variantes
const OM_SUCCESS_STATUSES = new Set([
  'SUCCESS', 'SUCCESSFUL', 'success', 'successful',
  'PAYMENT_SUCCESS', 'COMPLETED', 'completed',
])

Deno.serve(async (req) => {
  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS' || req.method === 'HEAD') return new Response(null, { status: 200 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url    = new URL(req.url)
    const piId   = url.searchParams.get('pi_id') ?? ''
    const secret = url.searchParams.get('secret') ?? url.searchParams.get('amp;secret') ?? ''

    if (!piId || !isUUID(piId)) return json({ error: 'pi_id invalide' }, 400)

    if (!OM_WEBHOOK_SECRET) {
      console.error('webhook-fitness-abo: OM_WEBHOOK_SECRET non configuré')
      return json({ error: 'Configuration manquante' }, 503)
    }
    if (secret !== OM_WEBHOOK_SECRET) {
      console.error('[webhook-fitness-abo] secret invalide')
      return json({ error: 'Non autorisé' }, 401)
    }

    let notification: Record<string, unknown>
    try {
      notification = await req.json() as Record<string, unknown>
    } catch {
      return json({ error: 'Body invalide' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Charger le payment_intent
    const { data: pi } = await admin
      .from('payment_intents')
      .select('*')
      .eq('id', piId)
      .maybeSingle()

    if (!pi) return json({ error: 'Payment intent introuvable' }, 404)

    // Idempotence : déjà traité
    if (pi.statut === 'completed' || pi.statut === 'split_done') {
      return json({ received: true })
    }

    const externalStatus = notification.status as string | undefined
    const externalRef    = (notification.transactionId ?? notification.payToken ?? notification.txId) as string | undefined

    console.log('[webhook-fitness-abo] reçu:', JSON.stringify({ piId, externalStatus, externalRef }))

    // Échec côté OM
    if (externalStatus === 'FAILED' || externalStatus === 'failed') {
      await admin.from('payment_intents').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', piId)
      return json({ received: true })
    }

    // Statut non reconnu → accuser réception sans traiter (OM ne retry pas en boucle)
    if (!externalStatus || !OM_SUCCESS_STATUSES.has(externalStatus)) {
      console.warn('[webhook-fitness-abo] statut inconnu:', externalStatus)
      return json({ received: true })
    }

    // Vérifier le montant
    const omAmount   = notification.amount as Record<string, unknown> | undefined
    const rawAmount  = omAmount?.value ?? omAmount?.montant ?? notification.montant ?? notification.totalAmount
    const reçu       = rawAmount !== undefined ? Math.round(Number(rawAmount)) : null
    const attendu    = Math.round(Number(pi.montant_total))

    if (reçu !== null && reçu !== attendu) {
      console.error('[webhook-fitness-abo] montant incohérent', { reçu, attendu, piId })
      await admin.from('payment_intents')
        .update({ statut: 'disputed', updated_at: new Date().toISOString() })
        .eq('id', piId)
      return json({ received: true })
    }

    // Marquer confirmé puis appeler confirm_order_from_payment (flux standard)
    // → met en split_done + insère dans payout_queue (reversement prestataire)
    await admin.from('payment_intents').update({
      statut:          'confirmed',
      external_status: externalStatus,
      external_ref:    externalRef ?? null,
      confirmed_at:    new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    }).eq('id', piId).eq('statut', 'initiated')

    const { data: confirmResult, error: confirmErr } = await admin.rpc('confirm_order_from_payment', {
      p_payment_intent_id: piId,
    })

    if (confirmErr) {
      console.error('[webhook-fitness-abo] confirm_order_from_payment erreur:', confirmErr.message)
      // Ne pas bloquer : activer quand même l'abonnement
    }

    // Activer l'abonnement
    await activerAbonnement(admin, pi, externalRef)

    console.log('[webhook-fitness-abo] abonnement activé, split:', JSON.stringify(confirmResult))

    return json({ received: true })

  } catch (err: unknown) {
    console.error('webhook-fitness-abo erreur:', err instanceof Error ? err.message : err)
    return json({ error: 'Erreur interne' }, 500)
  }
})

async function activerAbonnement(
  admin: ReturnType<typeof createClient>,
  pi: Record<string, unknown>,
  transactionId?: string,
) {
  const meta = (pi.metadata as Record<string, unknown>) ?? {}
  const offreId    = meta.offre_id   as string
  const offreNom   = meta.offre_nom  as string
  const dureeJours = Number(meta.duree_jours ?? 30)

  const dateAchat      = new Date()
  const dateExpiration = new Date(dateAchat.getTime() + dureeJours * 86_400_000)

  // Idempotence : si l'abonnement existe déjà (double webhook), ne pas dupliquer
  const { data: existing } = await admin
    .from('fitness_abonnements_clients')
    .select('id')
    .eq('payment_intent_id', pi.id as string)
    .maybeSingle()

  if (existing) return

  const { error } = await admin.from('fitness_abonnements_clients').insert({
    offre_id:          offreId,
    client_id:         pi.client_id,
    prestataire_id:    pi.prestataire_id,
    nom_offre:         offreNom,
    prix_paye:         pi.montant_total,
    date_achat:        dateAchat.toISOString(),
    date_expiration:   dateExpiration.toISOString(),
    statut:            'actif',
    payment_intent_id: pi.id,
  })

  if (error) {
    console.error('[webhook-fitness-abo] erreur insert abonnement:', error.message)
    throw new Error(error.message)
  }

  const clientBody = `Ton abonnement « ${offreNom} » est actif jusqu'au ${dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`

  // Notification in-app au client
  await admin.from('notifications').insert({
    user_id: pi.client_id,
    type:    'payment',
    title:   'Abonnement activé',
    body:    clientBody,
    data:    { type: 'fitness_abonnement' },
  })

  // Push au client (bannière)
  const { data: clientTokenRows, error: clientTokErr } = await admin.from('push_tokens').select('token').eq('user_id', pi.client_id)
  const clientTokens = ((clientTokenRows ?? []) as { token: string }[]).map(r => r.token)
  console.log('[abo-notif] client_id:', pi.client_id, 'tokens:', clientTokens.length, 'err:', clientTokErr?.message)
  if (clientTokens.length > 0) {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(clientTokens.map(to => ({
        to, title: 'Abonnement activé', body: clientBody,
        data: { type: 'fitness_abonnement' }, sound: 'default',
      }))),
    }).catch(e => { console.error('[abo-notif] push client fetch err:', e); return null })
    const expoData = await expoRes?.json().catch(() => null)
    console.log('[abo-notif] expo client response:', JSON.stringify(expoData))
  }

  // Push + notif in-app immédiate au prestataire (comme "Nouvelle commande")
  try {
    const { data: cp } = await admin.from('profiles').select('name').eq('id', pi.client_id as string).maybeSingle()
    const clientName = (cp?.name as string) ?? 'Un client'
    const prestTitle = 'Nouvel abonné'
    const prestBody  = `${clientName} a souscrit à "${offreNom}".`

    const { data: prestTokenRows, error: prestTokErr } = await admin.from('push_tokens').select('token').eq('user_id', pi.prestataire_id)
    const prestTokens = ((prestTokenRows ?? []) as { token: string }[]).map(r => r.token)
    console.log('[abo-notif] prestataire_id:', pi.prestataire_id, 'tokens:', prestTokens.length, 'err:', prestTokErr?.message)
    if (prestTokens.length > 0) {
      const expoRes2 = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(prestTokens.map(to => ({
          to, title: prestTitle, body: prestBody,
          data: { type: 'fitness_abonnement_nouveau', offre_id: offreId },
          sound: 'default', channelId: 'commandes',
        }))),
      })
      const expoData2 = await expoRes2.json().catch(() => null)
      console.log('[abo-notif] expo prestataire response:', JSON.stringify(expoData2))
    }

    await admin.from('notifications').insert({
      user_id: pi.prestataire_id,
      type:    'commande',
      title:   prestTitle,
      body:    prestBody,
      data:    { type: 'fitness_abonnement_nouveau', offre_id: offreId },
    })
  } catch (e) {
    console.error('[abo-notif] prestataire bloc erreur:', e instanceof Error ? e.message : e)
  }
}
