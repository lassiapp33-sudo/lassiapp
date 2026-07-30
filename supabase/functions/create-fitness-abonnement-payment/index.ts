// ============================================================
// EDGE FUNCTION : create-fitness-abonnement-payment
// Crée une session de paiement Wave/OM pour un abonnement fitness.
// Même modèle économique que les commandes : commission 1% LASSI.
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

// Commission LASSI : 1% — NE JAMAIS CHANGER (les 10% = livreurs admin interne uniquement)
function calculerPrixClient(prixBase: number): number {
  const commission = Math.ceil(prixBase * 0.01)
  return prixBase + commission
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
    // ① Authentification
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Validation du body
    let body: { offreId?: unknown; payMethod?: unknown }
    try { body = await req.json() } catch { return json({ error: 'Body invalide' }, 400) }

    const { offreId, payMethod } = body
    if (!offreId || !payMethod)                         return json({ error: 'offreId et payMethod requis' }, 400)
    if (!isUUID(offreId as string))                     return json({ error: 'offreId invalide' }, 400)
    if (!['wave', 'orange_money'].includes(payMethod as string)) return json({ error: 'payMethod invalide' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Charger l'offre
    const { data: offre } = await admin
      .from('fitness_abonnement_offres')
      .select('*')
      .eq('id', offreId)
      .eq('actif', true)
      .maybeSingle()

    if (!offre) return json({ error: 'Offre introuvable ou inactive' }, 404)

    const prixBase   = offre.prix as number
    const commission = Math.ceil(prixBase * 0.01)
    const prixTotal  = calculerPrixClient(prixBase)
    const dureeJours = (offre.duree_jours as number) || 30

    // ④ Créer le payment_intent (même table que les paiements classiques)
    const idempotencyKey = `fitness-${offre.id}-${user.id}-${Date.now()}`
    const { data: pi, error: piError } = await admin
      .from('payment_intents')
      .insert({
        client_id:        user.id,
        prestataire_id:   offre.prestataire_id,
        montant_total:    prixTotal,
        commission_lassi: commission,
        prix_base:        prixBase,
        statut:           'pending',
        moyen_paiement:   payMethod,
        idempotency_key:  idempotencyKey,
        metadata:         { offre_id: offre.id, offre_nom: offre.nom, duree_jours: dureeJours },
      })
      .select('id')
      .single()

    if (piError) throw new Error(piError.message)
    const piId = pi.id as string

    // ⑤ Mode simulation si clés non configurées
    if (!IS_PRODUCTION) {
      await admin.from('payment_intents')
        .update({ statut: 'simulated', external_ref: `SIM-FITNESS-${Date.now()}` })
        .eq('id', piId)

      // En mode simulation, créer directement l'abonnement
      const dateAchat = new Date()
      const dateExpiration = new Date(dateAchat.getTime() + dureeJours * 86_400_000)
      await admin.from('fitness_abonnements_clients').insert({
        offre_id:          offre.id,
        client_id:         user.id,
        prestataire_id:    offre.prestataire_id,
        nom_offre:         offre.nom,
        prix_paye:         prixTotal,
        date_achat:        dateAchat.toISOString(),
        date_expiration:   dateExpiration.toISOString(),
        statut:            'actif',
        payment_intent_id: piId,
      })

      return json({
        success:    true,
        mode:       'simulation',
        piId,
        redirectUrl: null,
        qrCode:     null,
      })
    }

    // ⑥ Production Wave
    if (payMethod === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(prixTotal),
        success_url:      `${APP_BASE_URL}fitness-abo-success?pi=${piId}`,
        error_url:        `${APP_BASE_URL}fitness-abo-error?pi=${piId}`,
        client_reference: piId,
      })

      const waveRes = await callWaveCheckout(waveBody, piId)
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')

      await admin.from('payment_intents')
        .update({ statut: 'initiated', external_ref: waveData.id ?? piId })
        .eq('id', piId)

      return json({
        success:    true,
        mode:       'production',
        piId,
        redirectUrl: waveData.wave_launch_url ?? null,
        qrCode:     null,
      })
    }

    // ⑦ Production Orange Money
    if (!OM_WEBHOOK_SECRET) throw new Error('OM_WEBHOOK_SECRET non configuré')
    const omToken = await getOmToken()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Utiliser webhook-payment (URL fixe enregistrée dans le dashboard OM)
    // OM ignore le notificationUrl dynamique et appelle toujours l'URL du dashboard.
    const callbackUrl =
      `${supabaseUrl}/functions/v1/webhook-payment` +
      `?source=om` +
      `&pi_id=${encodeURIComponent(piId)}` +
      `&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`

    const omRes = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${omToken}`,
        'Content-Type':   'application/json',
        'X-Callback-Url': callbackUrl,
      },
      body: JSON.stringify({
        code:            OM_MERCHANT_CODE,
        name:            'LASSI',
        amount:          { value: prixTotal, unit: 'XOF' },
        validity:        900,
        metadata:        { pi_id: piId },
        notificationUrl: callbackUrl,
      }),
    })
    const omData = await omRes.json()
    if (!omRes.ok) throw new Error(omData.message ?? JSON.stringify(omData))

    await admin.from('payment_intents')
      .update({ statut: 'initiated', external_ref: piId })
      .eq('id', piId)

    return json({
      success:     true,
      mode:        'production',
      piId,
      redirectUrl: omData.deepLinks?.OM ?? omData.deepLink ?? null,
      qrCode:      omData.qrCode ?? null,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[create-fitness-abonnement-payment]', msg)
    return json({ error: msg }, 500)
  }
})
