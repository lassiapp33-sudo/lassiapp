import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts'
import { callWaveCheckout } from '../_shared/waveProxy.ts'

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? ''
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')    ?? ''
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? ''
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''

const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== ''
const IS_OM_READY   = isOmReady()

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ① Auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token!)
    if (authError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Paramètres
    const { reservationId, moyenPaiement } = await req.json()
    if (!reservationId || !moyenPaiement) return json({ error: 'Paramètres manquants' }, 400)
    if (!isUUID(reservationId)) return json({ error: 'reservationId invalide' }, 400)
    if (!['wave', 'orange_money'].includes(moyenPaiement)) {
      return json({ error: 'Moyen de paiement invalide' }, 400)
    }

    // ③ Charger la réservation — montant toujours depuis la DB, jamais le client
    const { data: resa, error: resaErr } = await supabase
      .from('reservations_terrain')
      .select('id, client_id, prix_total, statut')
      .eq('id', reservationId)
      .single()

    if (resaErr || !resa) return json({ error: 'Réservation introuvable' }, 404)
    if (resa.client_id !== user.id) return json({ error: 'Accès interdit' }, 403)
    if (resa.statut !== 'en_attente') return json({ error: 'Réservation non payable' }, 409)

    const montantTotal = resa.prix_total as number

    // ④ Initier le paiement chez le fournisseur
    const useWaveProd = IS_WAVE_READY && moyenPaiement === 'wave'
    const useOmProd   = IS_OM_READY   && moyenPaiement === 'orange_money'

    let reference: string
    let paymentUrl: string | null = null
    let qrCode: string | null = null

    if (useWaveProd) {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(montantTotal),
        error_url:        `lassiapp://terrain/paiement/echec?r=${reservationId}`,
        success_url:      `lassiapp://terrain/paiement/succes?r=${reservationId}`,
        client_reference: reservationId,
      })
      const response = await callWaveCheckout(waveBody, reservationId)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(`Wave error: ${JSON.stringify(err)}`)
      }
      const data = await response.json()
      reference  = data.id ?? data.transaction_id
      paymentUrl = data.wave_launch_url ?? data.checkout_url

    } else if (useOmProd) {
      if (!OM_WEBHOOK_SECRET) throw new Error('OM_WEBHOOK_SECRET non configuré')
      const omToken      = await getOmToken()
      const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
      const callbackUrl  =
        `${supabaseUrl}/functions/v1/webhook-payment` +
        `?source=om&terrain_r=${encodeURIComponent(reservationId)}` +
        `&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`

      const response = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
        method: 'POST',
        headers: {
          'Authorization':  `Bearer ${omToken}`,
          'Content-Type':   'application/json',
          'X-Callback-Url': callbackUrl,
        },
        body: JSON.stringify({
          code:            OM_MERCHANT_CODE,
          name:            'LASSI Terrain',
          amount:          { value: montantTotal, unit: 'XOF' },
          validity:        900,
          metadata:        { terrain_reservation_id: reservationId },
          notificationUrl: callbackUrl,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(`OM erreur: ${err.message ?? JSON.stringify(err)}`)
      }
      const data = await response.json()
      console.log('[create-terrain-payment] OM response keys:', JSON.stringify({
        keys: Object.keys(data), orderId: data.orderId, id: data.id,
      }))
      reference  = data.orderId ?? data.id ?? data.payToken ?? data.txId ?? data.reference ?? reservationId
      paymentUrl = data.deepLinks?.OM ?? data.deepLink ?? null
      qrCode     = data.qrCode ?? null

    } else {
      // Simulation
      await new Promise(r => setTimeout(r, 400))
      reference  = `SIM-TERRAIN-${Date.now()}-${reservationId.slice(0, 8).toUpperCase()}`
      paymentUrl = null
    }

    // ⑤ Stocker la référence dans la réservation
    await supabase
      .from('reservations_terrain')
      .update({ paiement_ref: reference, moyen_paiement: moyenPaiement })
      .eq('id', reservationId)

    return json({ reference, paymentUrl, qrCode, simulation: !useWaveProd && !useOmProd })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[create-terrain-payment]', msg)
    return json({ error: msg }, 500)
  }
})
