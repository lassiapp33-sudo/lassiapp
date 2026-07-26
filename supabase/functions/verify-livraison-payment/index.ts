// ============================================================
// EDGE FUNCTION : verify-livraison-payment
// Vérifie le paiement et crée la livraison si confirmé.
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
      const livraison = await creerLivraison(admin, user.id, lp)
      await admin.from('livraison_paiements').update({ livraison_id: livraison.id }).eq('id', lp.id)
      return json({ paid: true, livraisonId: livraison.id })
    }

    // ⑥ Déjà complété par webhook
    if (pi.statut === 'completed') {
      const livraison = await creerLivraison(admin, user.id, lp)
      await admin.from('livraison_paiements').update({ livraison_id: livraison.id }).eq('id', lp.id)
      return json({ paid: true, livraisonId: livraison.id })
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

          const livraison = await creerLivraison(admin, user.id, lp)
          await admin.from('livraison_paiements').update({ livraison_id: livraison.id }).eq('id', lp.id)
          return json({ paid: true, livraisonId: livraison.id })
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

// ── Crée la livraison après paiement confirmé ──────────────────────────────
async function creerLivraison(
  admin: ReturnType<typeof createClient>,
  demandeurId: string,
  lp: Record<string, unknown>,
) {
  // Détermine le type depuis le profil — ne pas faire confiance au client
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
  return data as { id: string }
}
