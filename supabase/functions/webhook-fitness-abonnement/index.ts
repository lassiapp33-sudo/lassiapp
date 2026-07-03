// ============================================================
// EDGE FUNCTION : webhook-fitness-abonnement
// Reçoit les notifications OM après paiement d'un abonnement fitness.
// Pour Wave : la vérification est faite via verify-fitness-payment.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'

const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''

interface OmNotification {
  amount:         { value: number; unit: string }
  transactionId?: string
  status:         'SUCCESS' | 'FAILED' | string
}

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
    const secret = url.searchParams.get('secret') ?? ''

    if (!piId || !isUUID(piId)) return json({ error: 'pi_id invalide' }, 400)

    if (!OM_WEBHOOK_SECRET) {
      console.error('webhook-fitness-abo: OM_WEBHOOK_SECRET non configuré')
      return json({ error: 'Configuration manquante' }, 503)
    }
    if (secret !== OM_WEBHOOK_SECRET) return json({ error: 'Non autorisé' }, 401)

    let notification: OmNotification
    try {
      notification = await req.json() as OmNotification
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
    if (pi.statut === 'completed') return json({ received: true }) // idempotent

    if (notification.status === 'FAILED') {
      await admin.from('payment_intents').update({ statut: 'failed' }).eq('id', piId)
      return json({ received: true })
    }
    if (notification.status !== 'SUCCESS') return json({ received: true })

    // Vérifier le montant
    const reçu    = Math.round(Number(notification.amount?.value))
    const attendu = Math.round(Number(pi.montant_total))
    if (reçu !== attendu) {
      console.error('[webhook-fitness-abo] montant incohérent', { reçu, attendu, piId })
      await admin.from('payment_intents').update({ statut: 'failed' }).eq('id', piId)
      return json({ received: true })
    }

    // Activer l'abonnement
    await activerAbonnement(admin, pi, notification.transactionId)

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
  const offreId   = meta.offre_id   as string
  const offreNom  = meta.offre_nom  as string
  const dureeJours = Number(meta.duree_jours ?? 30)

  const dateAchat      = new Date()
  const dateExpiration = new Date(dateAchat.getTime() + dureeJours * 86_400_000)

  await admin.from('payment_intents')
    .update({ statut: 'completed', external_ref: transactionId ?? pi.id })
    .eq('id', pi.id as string)

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

  // Notification in-app au client
  await admin.from('notifications').insert({
    user_id: pi.client_id,
    type:    'pay',
    title:   '🏋️ Abonnement activé !',
    body:    `Ton abonnement « ${offreNom} » est actif jusqu'au ${dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    data:    { type: 'fitness_abonnement' },
  }).catch(() => null)
}
