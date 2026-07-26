// ============================================================
// EDGE FUNCTION : create-livraison-payment
// Calcule le devis serveur-side (Haversine) — jamais côté client.
// Crée un payment_intent + livraison_paiements, initie Wave/OM.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts'
import { callWaveCheckout } from '../_shared/waveProxy.ts'

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? ''
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? ''
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''
const APP_BASE_URL      = Deno.env.get('APP_BASE_URL') ?? 'lassi://'

const IS_PRODUCTION = WAVE_API_KEY !== '' || isOmReady()

// ── Haversine (même logique que config/livraison.ts côté app) ──────────────
const PRIX_BASE       = 800  // 500 base + 300 forfait
const PRIX_PAR_KM     = 250
const PRIX_MINIMUM    = 1000
const PRIX_MAXIMUM    = 15000
const DISTANCE_MAX_KM = 30
const FACTEUR_ROUTE   = 1.3

function distanceVolOiseau(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculerDevis(dLat: number, dLng: number, aLat: number, aLng: number) {
  const distVol    = distanceVolOiseau(dLat, dLng, aLat, aLng)
  const distanceKm = Math.round(distVol * FACTEUR_ROUTE * 100) / 100
  const horsZone   = distanceKm > DISTANCE_MAX_KM
  if (horsZone) return { distanceKm, prix: 0, horsZone: true }
  const brut    = PRIX_BASE + distanceKm * PRIX_PAR_KM
  const arrondi = Math.ceil(brut / 50) * 50
  const prix    = Math.min(Math.max(arrondi, PRIX_MINIMUM), PRIX_MAXIMUM)
  return { distanceKm, prix, horsZone: false }
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  try {
    // ① Auth
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Body
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Body invalide' }, 400) }

    const {
      departLabel, departLat, departLng,
      arriveeLabel, arriveeLat, arriveeLng,
      contactNom, contactTel,
      moyenPaiement,
    } = body

    if (!departLabel || departLat == null || departLng == null) return json({ error: 'Départ invalide' }, 400)
    if (!arriveeLabel || arriveeLat == null || arriveeLng == null) return json({ error: 'Arrivée invalide' }, 400)
    if (!moyenPaiement || !['wave', 'orange_money'].includes(moyenPaiement as string)) {
      return json({ error: 'Moyen de paiement invalide' }, 400)
    }

    // ③ Calcul devis serveur-side (pas de montant depuis le client)
    const devis = calculerDevis(
      Number(departLat), Number(departLng),
      Number(arriveeLat), Number(arriveeLng),
    )
    if (devis.horsZone) return json({ error: `Distance trop grande (${devis.distanceKm.toFixed(1)} km) — max ${DISTANCE_MAX_KM} km` }, 422)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ④ Créer le payment_intent (même table que les autres paiements)
    const idempotencyKey = `livraison-${user.id}-${Date.now()}`
    const { data: pi, error: piError } = await admin
      .from('payment_intents')
      .insert({
        client_id:        user.id,
        prestataire_id:   user.id,    // LASSI collecte : prestataire = demandeur
        montant_total:    devis.prix,
        commission_lassi: 0,           // LASSI = opérateur, garde tout
        prix_base:        devis.prix,
        statut:           'pending',
        moyen_paiement:   moyenPaiement,
        idempotency_key:  idempotencyKey,
      })
      .select('id')
      .single()

    if (piError) throw new Error(piError.message)
    const piId = pi.id as string

    // ⑤ Stocker les params livraison (pour création après paiement)
    const { data: lp, error: lpError } = await admin
      .from('livraison_paiements')
      .insert({
        payment_intent_id: piId,
        demandeur_id:      user.id,
        depart_label:      departLabel,
        depart_lat:        Number(departLat),
        depart_lng:        Number(departLng),
        arrivee_label:     arriveeLabel,
        arrivee_lat:       Number(arriveeLat),
        arrivee_lng:       Number(arriveeLng),
        contact_nom:       contactNom ?? null,
        contact_tel:       contactTel ?? null,
        distance_km:       devis.distanceKm,
        montant_calcule:   devis.prix,
      })
      .select('id')
      .single()

    if (lpError) throw new Error(lpError.message)

    // ⑥ Mode simulation
    if (!IS_PRODUCTION) {
      await admin.from('payment_intents')
        .update({ statut: 'simulated', external_ref: `SIM-LIV-${Date.now()}` })
        .eq('id', piId)

      return json({ success: true, mode: 'simulation', piId, lpId: lp.id, redirectUrl: null, qrCode: null, montant: devis.prix, distanceKm: devis.distanceKm })
    }

    // ⑦ Wave
    if (moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(devis.prix),
        success_url:      `${APP_BASE_URL}livraison-success?pi=${piId}`,
        error_url:        `${APP_BASE_URL}livraison-error?pi=${piId}`,
        client_reference: piId,
      })

      const waveRes  = await callWaveCheckout(waveBody, piId)
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')

      await admin.from('payment_intents')
        .update({ statut: 'initiated', external_ref: waveData.id ?? piId })
        .eq('id', piId)

      return json({ success: true, mode: 'production', piId, lpId: lp.id, redirectUrl: waveData.wave_launch_url ?? null, qrCode: null, montant: devis.prix, distanceKm: devis.distanceKm })
    }

    // ⑧ Orange Money
    if (!OM_WEBHOOK_SECRET) throw new Error('OM_WEBHOOK_SECRET non configuré')
    const omToken     = await getOmToken()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const callbackUrl = `${supabaseUrl}/functions/v1/webhook-payment?source=om&pi_id=${encodeURIComponent(piId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`

    const omRes = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${omToken}`, 'Content-Type': 'application/json', 'X-Callback-Url': callbackUrl },
      body: JSON.stringify({ code: OM_MERCHANT_CODE, name: 'LASSI Livraison', amount: { value: devis.prix, unit: 'XOF' }, validity: 900, metadata: { pi_id: piId } }),
    })

    if (!omRes.ok) { const e = await omRes.json(); throw new Error(`OM: ${e.message ?? JSON.stringify(e)}`) }
    const omData  = await omRes.json()
    const deepLink = omData.deepLinks?.OM ?? omData.deepLink ?? null

    await admin.from('payment_intents')
      .update({ statut: 'initiated', external_ref: piId })
      .eq('id', piId)

    return json({ success: true, mode: 'production', piId, lpId: lp.id, redirectUrl: deepLink, qrCode: omData.qrCode ?? null, montant: devis.prix, distanceKm: devis.distanceKm })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    console.error('[create-livraison-payment]', msg)
    return json({ error: msg }, 500)
  }
})
