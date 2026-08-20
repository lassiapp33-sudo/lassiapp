// ============================================================
// EDGE FUNCTION : verify-livraison-payment
// Vérifie le paiement et crée la livraison si confirmé.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { buildWaveSignature } from '../_shared/waveSign.ts'
import { sendPushToUser } from '../_shared/push.ts'

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

    // ② Charger le payment_intent (appartient à l'utilisateur)
    const { data: pi } = await admin
      .from('payment_intents')
      .select('*')
      .eq('id', piId)
      .eq('client_id', user.id)
      .maybeSingle()

    if (!pi) return json({ error: 'Payment intent introuvable' }, 404)

    // ③ Charger les params livraison
    const { data: lp } = await admin
      .from('livraison_paiements')
      .select('*')
      .eq('payment_intent_id', piId)
      .maybeSingle()

    if (!lp) return json({ error: 'Données livraison introuvables' }, 404)

    // ④ Déjà traité (idempotent)
    if (lp.livraison_id) {
      return json({ paid: true, livraisonId: lp.livraison_id })
    }

    // ⑤ Simulation : considéré comme payé
    if (pi.statut === 'simulated') {
      const livraisonId = await creerLivraisonAtomique(admin, user.id, lp)
      await notifierLivreurs(admin, livraisonId, lp)
      return json({ paid: true, livraisonId })
    }

    // ⑥ Déjà complété par webhook (process_payment_webhook → 'split_done')
    if (['completed', 'split_done', 'confirmed'].includes(pi.statut)) {
      const livraisonId = await creerLivraisonAtomique(admin, user.id, lp)
      await notifierLivreurs(admin, livraisonId, lp)
      return json({ paid: true, livraisonId })
    }

    // ⑦ Vérification Wave en temps réel
    if (pi.moyen_paiement === 'wave' && pi.external_ref && WAVE_API_KEY) {
      const waveRes = await fetch(`https://api.wave.com/v1/checkout/sessions/${pi.external_ref}`, {
        headers: { Authorization: `Bearer ${WAVE_API_KEY}`, ...buildWaveSignature('', WAVE_API_KEY) },
      })

      if (waveRes.ok) {
        const waveData = await waveRes.json()
        if (waveData.payment_status === 'succeeded') {
          await admin.from('payment_intents')
            .update({ statut: 'completed' })
            .eq('id', piId)

          const livraisonId = await creerLivraisonAtomique(admin, user.id, lp)
          await notifierLivreurs(admin, livraisonId, lp)
          return json({ paid: true, livraisonId })
        }
      }
    }

    return json({ paid: false })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    console.error('[verify-livraison-payment]', msg)
    return json({ error: msg }, 500)
  }
})

// ── Notifie tous les livreurs actifs d'une nouvelle livraison ─────────────
async function notifierLivreurs(
  admin: ReturnType<typeof createClient>,
  livraisonId: string,
  lp: Record<string, unknown>,
) {
  try {
    const { data: livreurs } = await admin
      .from('livreurs')
      .select('id')
      .eq('actif', true)
    const distKm = lp.distance_km ? `${Number(lp.distance_km).toFixed(1)} km` : ''
    for (const livreur of (livreurs ?? [])) {
      await sendPushToUser(admin, livreur.id, {
        title:     'Nouvelle livraison disponible',
        body:      `${lp.depart_label} → ${lp.arrivee_label}${distKm ? ' · ' + distKm : ''}`,
        data:      { type: 'livraison_nouvelle', livraisonId },
        channelId: 'commandes',
      })
    }
  } catch (e) {
    console.error('[verify-livraison-payment] notifierLivreurs erreur:', e instanceof Error ? e.message : e)
  }
}

// ── Crée la livraison après paiement confirmé (verrouillage optimiste) ─────
// Retourne l'id de la livraison créée OU celle déjà existante si race condition.
async function creerLivraisonAtomique(
  admin: ReturnType<typeof createClient>,
  demandeurId: string,
  lp: Record<string, unknown>,
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', demandeurId)
    .single()

  const demandeurType =
    profile?.role === 'merchant' || profile?.role === 'prestataire'
      ? 'prestataire'
      : 'client'

  const { data, error } = await admin
    .from('livraisons')
    .insert({
      demandeur_id:   demandeurId,
      demandeur_type: demandeurType,
      depart_label:   lp.depart_label,
      depart_lat:     lp.depart_lat,
      depart_lng:     lp.depart_lng,
      arrivee_label:  lp.arrivee_label,
      arrivee_lat:    lp.arrivee_lat,
      arrivee_lng:    lp.arrivee_lng,
      contact_nom:    lp.contact_nom ?? null,
      contact_tel:    lp.contact_tel ?? null,
      distance_km:    lp.distance_km,
      prix_livraison: lp.montant_calcule,
      statut:         'en_attente',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const nouvelleId = (data as { id: string }).id

  // Verrouillage optimiste : n'écrit que si livraison_id est encore null.
  // Si une requête concurrente a déjà pris la main, on rollback la livraison créée
  // et on retourne l'id existant pour rester idempotent.
  const { data: claimed } = await admin
    .from('livraison_paiements')
    .update({ livraison_id: nouvelleId })
    .eq('id', lp.id as string)
    .is('livraison_id', null)
    .select('id')

  if (!claimed || claimed.length === 0) {
    console.warn('[verify-livraison-payment] doublon détecté, rollback livraison', nouvelleId)
    await admin.from('livraisons').delete().eq('id', nouvelleId)
    // Récupère l'id de la livraison gagnante
    const { data: existing } = await admin
      .from('livraison_paiements')
      .select('livraison_id')
      .eq('id', lp.id as string)
      .single()
    return (existing as { livraison_id: string }).livraison_id
  }

  return nouvelleId
}
