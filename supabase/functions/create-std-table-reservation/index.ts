// ============================================================
// EDGE FUNCTION : create-std-table-reservation
// Crée une réservation de table pour un restaurant standard
// (sous-catégorie "restaurant" — non VIP 5 Étoiles).
// Montant fixé serveur : le client paie 2100 FCFA. 2000 FCFA = acompte
// restaurant (entièrement déduit de l'addition sur place, prix_base), 100 FCFA
// = frais de service LASSI (commission_lassi). Le restaurant est reversé sur la
// base des 2000 FCFA (net ~1959-1963 après frais Wave/OM, comme partout).
//
// IMPORTANT : cette fonction NE crée PAS la réservation. Elle crée uniquement le
// payment_intent (détails résa dans metadata). La réservation n'est insérée
// qu'au paiement confirmé, via la RPC confirm_table_reservation_payment appelée
// par webhook-payment. Une résa n'existe donc QUE si le client a payé.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { callWaveCheckout } from '../_shared/waveProxy.ts'
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts'
import { sendPushToUser } from '../_shared/push.ts'

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? ''
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')    ?? ''
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? ''
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? ''
const APP_BASE_URL      = Deno.env.get('APP_BASE_URL')      ?? 'lassi://'

const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== ''
const IS_OM_READY   = isOmReady()
const IS_PRODUCTION = IS_WAVE_READY || IS_OM_READY

const MONTANT_CLIENT   = 2100                                    // total payé par le client
const COMMISSION_LASSI = 100                                     // frais de service LASSI
const MONTANT_PRESTATAIRE = MONTANT_CLIENT - COMMISSION_LASSI    // 2000 FCFA acompte restaurant (prix_base)

const MOTIFS_VALIDES  = ['anniversaire', 'mariage', 'fiancailles', 'fete_surprise', 'affaires', 'romantique', 'autre']
const OPTIONS_VALIDES = ['bougie', 'emplacement_intime', 'chaise_haute', 'decoration_table']

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
      prestataireId,
      spaceId,
      timeSlotId,
      dateReservation,
      heureDebut,
      nbPersonnes,
      motif,
      detailsMotif,
      optionsSpeciales,
      moyenPaiement,
    } = body

    // ③ Validation
    if (!isUUID(prestataireId))                          return json({ error: 'prestataireId invalide' }, 400)
    if (spaceId    && !isUUID(spaceId))                  return json({ error: 'spaceId invalide' }, 400)
    if (timeSlotId && !isUUID(timeSlotId))               return json({ error: 'timeSlotId invalide' }, 400)
    if (typeof dateReservation !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateReservation)) {
      return json({ error: 'dateReservation invalide (YYYY-MM-DD attendu)' }, 400)
    }
    if (typeof heureDebut !== 'string' || !/^\d{2}:\d{2}$/.test(heureDebut)) {
      return json({ error: 'heureDebut invalide (HH:MM attendu)' }, 400)
    }
    const nb = Number(nbPersonnes)
    if (!Number.isInteger(nb) || nb < 1 || nb > 100) return json({ error: 'nbPersonnes invalide (1-100)' }, 400)
    if (motif && !MOTIFS_VALIDES.includes(motif as string)) return json({ error: 'motif invalide' }, 400)
    if (detailsMotif && !isSafeString(detailsMotif, { maxLen: 500 })) return json({ error: 'detailsMotif trop long' }, 400)
    const options = Array.isArray(optionsSpeciales) ? (optionsSpeciales as string[]).filter(o => OPTIONS_VALIDES.includes(o)) : []
    if (!['wave', 'orange_money'].includes(moyenPaiement as string)) return json({ error: 'moyenPaiement invalide' }, 400)

    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (new Date(dateReservation + 'T00:00:00') < today) {
      return json({ error: 'La date doit être dans le futur' }, 422)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ④ Vérifier que le prestataire existe et a bien la sous-catégorie restaurant
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, name')
      .eq('id', prestataireId)
      .single()

    if (profileError || !profile) return json({ error: 'Prestataire introuvable' }, 404)

    // ④bis Vérifier le shop : réservation activée + moyen de paiement autorisé
    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('reservation_enabled, payment_methods')
      .eq('merchant_id', prestataireId)
      .single()

    if (shopError || !shop) return json({ error: 'Restaurant introuvable' }, 404)
    if (shop.reservation_enabled !== true) {
      return json({ error: 'Ce restaurant ne propose pas la réservation de table' }, 422)
    }
    // On respecte strictement le choix du prestataire (Wave / OM / les deux)
    const allowed = Array.isArray(shop.payment_methods) ? shop.payment_methods as string[] : ['wave', 'om']
    const wanted  = moyenPaiement === 'wave' ? 'wave' : 'om'
    if (!allowed.includes(wanted)) {
      return json({ error: 'Moyen de paiement non accepté par ce restaurant' }, 422)
    }

    // ⑤ Vérifier l'espace (si fourni)
    if (spaceId) {
      const { data: space } = await admin
        .from('restaurant_spaces')
        .select('id')
        .eq('id', spaceId)
        .eq('prestataire_id', prestataireId)
        .eq('actif', true)
        .single()
      if (!space) return json({ error: 'Espace introuvable' }, 404)
    }

    // ⑥ Vérifier le créneau (si fourni)
    if (timeSlotId) {
      const { data: slot } = await admin
        .from('restaurant_time_slots')
        .select('id, heure_debut, heure_fin, jours_semaine')
        .eq('id', timeSlotId)
        .eq('prestataire_id', prestataireId)
        .eq('actif', true)
        .single()
      if (!slot) return json({ error: 'Créneau introuvable' }, 404)
      const dayOfWeek = new Date(dateReservation + 'T00:00:00').getDay()
      if (!slot.jours_semaine.includes(dayOfWeek)) {
        return json({ error: 'Ce créneau n\'est pas disponible ce jour' }, 422)
      }
    }

    // ⑦ Créer le payment_intent (la réservation n'est PAS créée ici — voir en-tête).
    //    Les détails de la résa vivent dans metadata jusqu'au paiement confirmé.
    const idempotencyKey = `std-table-resa-${user.id}-${prestataireId}-${dateReservation}-${Date.now()}`
    const resaMeta = {
      date_reservation:  dateReservation,
      heure_debut:       heureDebut,                 // "HH:MM"
      nb_personnes:      nb,
      motif:             motif ?? null,
      details_motif:     detailsMotif ?? null,
      options_speciales: options,
      space_id:          spaceId ?? null,
      time_slot_id:      timeSlotId ?? null,
    }
    const { data: pi, error: piError } = await admin
      .from('payment_intents')
      .insert({
        type:             'table_reservation',
        client_id:        user.id,
        prestataire_id:   prestataireId,
        montant_total:    MONTANT_CLIENT,
        commission_lassi: COMMISSION_LASSI,
        prix_base:        MONTANT_PRESTATAIRE,
        statut:           'pending',
        moyen_paiement:   moyenPaiement,
        idempotency_key:  idempotencyKey,
        metadata:         resaMeta,
      })
      .select('id')
      .single()

    if (piError) throw new Error(piError.message)
    const piId = pi.id as string

    // ⑧ Mode simulation : pas de webhook → on confirme + crée la résa directement.
    if (!IS_PRODUCTION) {
      await admin.from('payment_intents')
        .update({ statut: 'simulated', external_ref: `SIM-STDRS-${Date.now()}` })
        .eq('id', piId)

      const { data: rpcRes, error: rpcErr } = await admin
        .rpc('confirm_table_reservation_payment', { p_pi_id: piId })
      if (rpcErr) throw new Error(rpcErr.message)
      const resaId = (rpcRes as { reservation_id?: string })?.reservation_id ?? null

      await sendPushToUser(admin, prestataireId, {
        title:     'Nouvelle réservation de table [SIM]',
        body:      'Un client vient de payer son acompte. Acceptez ou refusez la réservation.',
        data:      { type: 'table_reservation_nouvelle', pi_id: String(piId) },
        channelId: 'commandes-v2',
      }).catch(() => {})

      return json({
        success: true,
        mode: 'simulation',
        reservationId: resaId,
        piId,
        redirectUrl: null,
        qrCode: null,
        montant: MONTANT_CLIENT,
      })
    }

    // ⑨ Wave
    if (moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(MONTANT_CLIENT),
        // Universal Link https (AASA lassi.tech /paiement/*) → iOS ouvre LASSI direct, sans prompt.
        success_url:      `https://lassi.tech/paiement/succes?r=${piId}`,
        error_url:        `https://lassi.tech/paiement/echec?r=${piId}`,
        client_reference: piId,
      })

      const waveRes  = await callWaveCheckout(waveBody, piId)
      const waveData = await waveRes.json()
      if (!waveRes.ok) throw new Error(waveData.message ?? 'Erreur Wave')

      await admin.from('payment_intents')
        .update({ statut: 'initiated', external_ref: waveData.id ?? piId })
        .eq('id', piId)

      return json({
        success: true,
        mode: 'production',
        piId,
        redirectUrl: waveData.wave_launch_url ?? null,
        qrCode: null,
        montant: MONTANT_CLIENT,
      })
    }

    // ⑩ Orange Money
    if (!OM_WEBHOOK_SECRET) throw new Error('OM_WEBHOOK_SECRET non configuré')
    const omToken     = await getOmToken()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const callbackUrl = `${supabaseUrl}/functions/v1/webhook-payment?source=om&pi_id=${encodeURIComponent(piId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`

    const omRes = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${omToken}`,
        'Content-Type':  'application/json',
        'X-Callback-Url': callbackUrl,
      },
      body: JSON.stringify({
        code:            OM_MERCHANT_CODE,
        name:            'LASSI Réservation Table',
        amount:          { value: MONTANT_CLIENT, unit: 'XOF' },
        validity:        900,
        metadata:        { pi_id: piId },
        notificationUrl: callbackUrl,
      }),
    })

    if (!omRes.ok) {
      const e = await omRes.json().catch(() => ({}))
      throw new Error(`OM: ${e.message ?? JSON.stringify(e)}`)
    }
    const omData   = await omRes.json()
    const deepLink = omData.deepLinks?.OM ?? omData.deepLink ?? null

    await admin.from('payment_intents')
      .update({ statut: 'initiated', external_ref: omData.payToken ?? piId })
      .eq('id', piId)

    return json({
      success: true,
      mode: 'production',
      piId,
      redirectUrl: deepLink,
      qrCode: omData.qrCode ?? null,
      montant: MONTANT_CLIENT,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[create-std-table-reservation]', msg)
    return json({ error: msg }, 500)
  }
})
