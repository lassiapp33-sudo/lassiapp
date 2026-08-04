// ============================================================
// EDGE FUNCTION : create-table-reservation
// Crée une demande de réservation de table (5 Étoiles uniquement)
// et initie le paiement de l'acompte (3 000 FCFA) + frais LASSI (200 FCFA).
//
// Sécurité : aucun montant ne vient du client.
// Les montants sont constants côté serveur : ACOMPTE=3000, FRAIS=200.
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

// Montants fixes — NE PAS accepter depuis le client
const ACOMPTE_MONTANT = 3000
const FRAIS_SERVICE   = 200
const MONTANT_TOTAL   = 3200

const MOTIFS_VALIDES = ['anniversaire', 'mariage', 'fiancailles', 'fete_surprise', 'affaires', 'romantique', 'autre']
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

    // ② Lecture du body
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Body invalide' }, 400) }

    const {
      vipProfilId,
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

    // ③ Validation des champs obligatoires
    if (!isUUID(vipProfilId))                          return json({ error: 'vipProfilId invalide' }, 400)
    if (spaceId    && !isUUID(spaceId))                return json({ error: 'spaceId invalide' }, 400)
    if (timeSlotId && !isUUID(timeSlotId))             return json({ error: 'timeSlotId invalide' }, 400)
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

    // Date dans le futur ?
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (new Date(dateReservation + 'T00:00:00') < today) {
      return json({ error: 'La date doit être dans le futur' }, 422)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ④ Vérifier que le vip_profil existe et est actif
    const { data: profil, error: profilError } = await admin
      .from('vip_profils')
      .select('id, nom_affiche, gerant_user_id')
      .eq('id', vipProfilId)
      .eq('actif', true)
      .single()

    if (profilError || !profil) return json({ error: 'Restaurant introuvable ou inactif' }, 404)
    if (!profil.gerant_user_id) return json({ error: 'Gérant non configuré pour ce restaurant' }, 422)

    // ⑤ Vérifier que l'espace appartient à ce restaurant (si fourni)
    if (spaceId) {
      const { data: space } = await admin
        .from('restaurant_spaces')
        .select('id')
        .eq('id', spaceId)
        .eq('vip_profil_id', vipProfilId)
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
        .eq('vip_profil_id', vipProfilId)
        .eq('actif', true)
        .single()
      if (!slot) return json({ error: 'Créneau introuvable' }, 404)
      // Vérifier que le créneau est disponible ce jour de semaine
      const dayOfWeek = new Date(dateReservation + 'T00:00:00').getDay()
      if (!slot.jours_semaine.includes(dayOfWeek)) {
        return json({ error: 'Ce créneau n\'est pas disponible ce jour' }, 422)
      }
    }

    // ⑦ Créer le payment_intent
    const idempotencyKey = `table-resa-${user.id}-${vipProfilId}-${dateReservation}-${Date.now()}`
    const { data: pi, error: piError } = await admin
      .from('payment_intents')
      .insert({
        type:             'table_reservation',
        client_id:        user.id,
        prestataire_id:   profil.gerant_user_id,
        montant_total:    MONTANT_TOTAL,
        commission_lassi: FRAIS_SERVICE,
        prix_base:        ACOMPTE_MONTANT,
        statut:           'pending',
        moyen_paiement:   moyenPaiement,
        idempotency_key:  idempotencyKey,
      })
      .select('id')
      .single()

    if (piError) throw new Error(piError.message)
    const piId = pi.id as string

    // ⑧ Créer la réservation (statut en_attente, paiement en_attente)
    const { data: resa, error: resaError } = await admin
      .from('table_reservations')
      .insert({
        client_id:         user.id,
        vip_profil_id:     vipProfilId,
        space_id:          spaceId ?? null,
        time_slot_id:      timeSlotId ?? null,
        date_reservation:  dateReservation,
        heure_debut:       heureDebut + ':00',
        nb_personnes:      nb,
        motif:             motif ?? null,
        details_motif:     detailsMotif ?? null,
        options_speciales: options,
        acompte_montant:   ACOMPTE_MONTANT,
        frais_service:     FRAIS_SERVICE,
        montant_total:     MONTANT_TOTAL,
        paiement_statut:   'en_attente',
        paiement_methode:  moyenPaiement,
        paiement_ref:      piId,
      })
      .select('id')
      .single()

    if (resaError) throw new Error(resaError.message)
    const resaId = resa.id as string

    // ⑨ Mode simulation
    if (!IS_PRODUCTION) {
      await admin.from('payment_intents')
        .update({ statut: 'simulated', external_ref: `SIM-RST-${Date.now()}` })
        .eq('id', piId)
      await admin.from('table_reservations')
        .update({ paiement_statut: 'paye', paiement_ref: piId })
        .eq('id', resaId)

      // Notifier le gérant (même en simulation, pour permettre les tests end-to-end)
      if (profil.gerant_user_id) {
        await sendPushToUser(admin, profil.gerant_user_id, {
          title:     '🍽️ Nouvelle réservation de table [SIM]',
          body:      'Un client vient de payer son acompte. Acceptez ou refusez la réservation.',
          data:      { type: 'table_reservation_nouvelle', pi_id: String(piId) },
          channelId: 'commandes',
        }).catch(() => { /* best-effort */ })
      }

      return json({
        success: true,
        mode: 'simulation',
        reservationId: resaId,
        piId,
        redirectUrl: null,
        qrCode: null,
        montant: MONTANT_TOTAL,
      })
    }

    // ⑩ Wave
    if (moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(MONTANT_TOTAL),
        success_url:      `${APP_BASE_URL}reservation-success?pi=${piId}&resa=${resaId}`,
        error_url:        `${APP_BASE_URL}reservation-error?pi=${piId}&resa=${resaId}`,
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
        reservationId: resaId,
        piId,
        redirectUrl: waveData.wave_launch_url ?? null,
        qrCode: null,
        montant: MONTANT_TOTAL,
      })
    }

    // ⑪ Orange Money
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
        amount:          { value: MONTANT_TOTAL, unit: 'XOF' },
        validity:        900,
        metadata:        { pi_id: piId, resa_id: resaId },
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
      reservationId: resaId,
      piId,
      redirectUrl: deepLink,
      qrCode: omData.qrCode ?? null,
      montant: MONTANT_TOTAL,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[create-table-reservation]', msg)
    return json({ error: msg }, 500)
  }
})
