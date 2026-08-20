// ============================================================
// EDGE FUNCTION : verify-fitness-payment
// Vérifie le statut d'un paiement Wave pour abonnement fitness
// et active l'abonnement si confirmé.
// Appelé par l'app après retour de l'URL Wave.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { buildWaveSignature } from '../_shared/waveSign.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const WAVE_API_KEY = Deno.env.get('WAVE_API_KEY') ?? ''

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  try {
    // ① Auth
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    let body: { piId?: unknown }
    try { body = await req.json() } catch { return json({ error: 'Body invalide' }, 400) }

    const { piId } = body
    if (!piId || !isUUID(piId as string)) return json({ error: 'piId invalide' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ② Charger le payment_intent (appartient bien au client)
    const { data: pi } = await admin
      .from('payment_intents')
      .select('*')
      .eq('id', piId)
      .eq('client_id', user.id)
      .maybeSingle()

    if (!pi) return json({ error: 'Payment intent introuvable' }, 404)

    // Déjà complété (idempotent) — inclut tous les statuts post-webhook OM/Wave
    const PAID_STATUSES = new Set(['completed', 'simulated', 'split_done', 'confirmed'])
    if (PAID_STATUSES.has(pi.statut as string)) {
      // Vérifier que l'abonnement est bien activé (sécurité double)
      const { data: abo } = await admin
        .from('fitness_abonnements_clients')
        .select('id, statut')
        .eq('payment_intent_id', pi.id)
        .maybeSingle()
      if (abo) return json({ paid: true, statut: pi.statut })
      // Paiement confirmé mais abonnement pas encore inséré (race condition webhook)
      // → retourner paid:true quand même, le webhook va finir
      if (pi.statut === 'split_done' || pi.statut === 'confirmed') {
        return json({ paid: true, statut: pi.statut })
      }
    }

    // OM : le webhook n'a pas encore répondu — on ne peut pas vérifier côté client
    if (pi.moyen_paiement === 'orange_money') {
      return json({ paid: false, statut: pi.statut, info: 'Attends la confirmation Orange Money (peut prendre 1-2 min).' })
    }

    // ③ Vérification Wave
    if (!WAVE_API_KEY) return json({ paid: false, statut: 'awaiting_keys' })

    const externalRef = pi.external_ref as string | null
    if (!externalRef) return json({ paid: false, statut: pi.statut })

    const waveHeaders: Record<string, string> = {
      Authorization: `Bearer ${WAVE_API_KEY}`,
    }
    const waveSig = await buildWaveSignature('')
    if (waveSig) waveHeaders['Wave-Signature'] = waveSig

    const res  = await fetch(`https://api.wave.com/v1/checkout/sessions/${externalRef}`, {
      headers: waveHeaders,
    })
    const data = await res.json()

    if (data.payment_status !== 'succeeded') {
      return json({ paid: false, statut: data.payment_status ?? 'pending' })
    }

    // ④ Activer l'abonnement
    const meta = (pi.metadata as Record<string, unknown>) ?? {}
    const dureeJours = Number(meta.duree_jours ?? 30)
    const dateAchat      = new Date()
    const dateExpiration = new Date(dateAchat.getTime() + dureeJours * 86_400_000)

    await admin.from('payment_intents')
      .update({ statut: 'completed' })
      .eq('id', piId as string)

    const { error: insertErr } = await admin.from('fitness_abonnements_clients').insert({
      offre_id:          meta.offre_id,
      client_id:         user.id,
      prestataire_id:    pi.prestataire_id,
      nom_offre:         meta.offre_nom,
      prix_paye:         pi.montant_total,
      date_achat:        dateAchat.toISOString(),
      date_expiration:   dateExpiration.toISOString(),
      statut:            'actif',
      payment_intent_id: piId,
    })

    if (insertErr) throw new Error(insertErr.message)

    const clientBody = `Ton abonnement « ${meta.offre_nom} » est actif jusqu'au ${dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`

    // Notification in-app au client
    await admin.from('notifications').insert({
      user_id: user.id,
      type:    'payment',
      title:   'Abonnement activé',
      body:    clientBody,
      data:    { type: 'fitness_abonnement' },
    })

    // Push au client (bannière)
    const { data: clientTokenRows } = await admin.from('push_tokens').select('token').eq('user_id', user.id)
    const clientTokens = ((clientTokenRows ?? []) as { token: string }[]).map(r => r.token)
    console.log('[verify-fitness] client_id:', user.id, 'tokens:', clientTokens.length)
    if (clientTokens.length > 0) {
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(clientTokens.map(to => ({
          to, title: 'Abonnement activé', body: clientBody,
          data: { type: 'fitness_abonnement' }, sound: 'default',
        }))),
      }).catch((e) => { console.error('[verify-fitness] push client err:', e); return null })
      const expoData = await expoRes?.json().catch(() => null)
      console.log('[verify-fitness] expo client response:', JSON.stringify(expoData))
    }

    // Push + notif in-app immédiate au prestataire (comme "Nouvelle commande")
    try {
      const { data: cp } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
      const clientName = (cp?.name as string) ?? 'Un client'
      const prestTitle = 'Nouvel abonné'
      const prestBody  = `${clientName} a souscrit à "${meta.offre_nom}".`

      const { data: prestTokenRows } = await admin.from('push_tokens').select('token').eq('user_id', pi.prestataire_id)
      const prestTokens = ((prestTokenRows ?? []) as { token: string }[]).map(r => r.token)
      console.log('[verify-fitness] prestataire_id:', pi.prestataire_id, 'tokens:', prestTokens.length)
      if (prestTokens.length > 0) {
        const expoRes2 = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(prestTokens.map(to => ({
            to, title: prestTitle, body: prestBody,
            data: { type: 'fitness_abonnement_nouveau', offre_id: meta.offre_id },
            sound: 'default', channelId: 'commandes',
          }))),
        }).catch(() => null)
        const expoData2 = await expoRes2?.json().catch(() => null)
        console.log('[verify-fitness] expo prestataire response:', JSON.stringify(expoData2))
      }

      await admin.from('notifications').insert({
        user_id: pi.prestataire_id,
        type:    'commande',
        title:   prestTitle,
        body:    prestBody,
        data:    { type: 'fitness_abonnement_nouveau', offre_id: meta.offre_id },
      })
    } catch {
      // best-effort
    }

    return json({ paid: true, statut: 'completed' })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[verify-fitness-payment]', msg)
    return json({ error: msg }, 500)
  }
})
