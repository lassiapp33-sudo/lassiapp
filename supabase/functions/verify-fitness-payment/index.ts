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

    // Déjà complété (idempotent)
    if (pi.statut === 'completed' || pi.statut === 'simulated') {
      return json({ paid: true, statut: pi.statut })
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

    // Notification in-app
    await admin.from('notifications').insert({
      user_id: user.id,
      type:    'pay',
      title:   '🏋️ Abonnement activé !',
      body:    `Ton abonnement « ${meta.offre_nom} » est actif jusqu'au ${dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      data:    { type: 'fitness_abonnement' },
    }).catch(() => null)

    return json({ paid: true, statut: 'completed' })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[verify-fitness-payment]', msg)
    return json({ error: msg }, 500)
  }
})
