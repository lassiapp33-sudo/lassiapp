import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isSafeString, isUUID } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts'
import { buildWaveSignature } from '../_shared/waveSign.ts'
import { triggerTerrainPayout } from '../_shared/terrainPayout.ts'
import { sendPushToUser } from '../_shared/push.ts'

const WAVE_API_KEY              = Deno.env.get('WAVE_API_KEY')              ?? ''
const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? ''
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? ''

function genReceiptCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    const { reference, method, reservationId } = await req.json()
    if (!reference || !method) return json({ error: 'reference et method requis' }, 400)
    if (!isSafeString(reference, { maxLen: 128, pattern: /^[A-Za-z0-9._-]+$/ })) {
      return json({ error: 'reference invalide' }, 400)
    }
    if (!['wave', 'om', 'orange_money'].includes(method)) return json({ error: 'method invalide' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Vérification DB d'abord (idempotence + webhook qui aurait déjà confirmé) ──
    if (reservationId && isUUID(reservationId)) {
      const { data: resaCheck } = await supabase
        .from('reservations_terrain')
        .select('client_id, statut, receipt_code, payout_statut, prestataire_id, montant_prestataire, moyen_paiement')
        .eq('id', reservationId)
        .single()

      if (!resaCheck || resaCheck.client_id !== user.id) {
        return json({ error: 'Réservation invalide' }, 403)
      }

      // Déjà confirmé → retourner directement (+ retry payout si nécessaire)
      if (resaCheck.statut === 'paye') {
        // Si payout n'a pas encore réussi, tenter un retry (best-effort)
        if (resaCheck.payout_statut !== 'ok') {
          console.log('[verify-terrain] retry payout, statut actuel=', resaCheck.payout_statut)
          await triggerTerrainPayout(supabase, {
            reservationId,
            prestataireId:             resaCheck.prestataire_id as string,
            montant:                   resaCheck.montant_prestataire as number,
            moyenPaiement:             (resaCheck.moyen_paiement ?? method) as string,
            WAVE_API_KEY,
            OM_RETAILER_MSISDN,
            OM_RETAILER_PIN_ENCRYPTED,
          })
        }
        return json({ paid: true, receipt_code: resaCheck.receipt_code })
      }
    }

    // ── Vérification côté opérateur ───────────────────────────────────────────
    let paid = false

    if (method === 'wave' && WAVE_API_KEY) {
      const waveGetHeaders: Record<string, string> = { Authorization: `Bearer ${WAVE_API_KEY}` }
      const waveSig = await buildWaveSignature('')
      if (waveSig) waveGetHeaders['Wave-Signature'] = waveSig
      const res  = await fetch(`https://api.wave.com/v1/checkout/sessions/${reference}`, { headers: waveGetHeaders })
      const data = await res.json()
      paid = (data as Record<string, unknown>).payment_status === 'succeeded'

    } else if ((method === 'om' || method === 'orange_money') && isOmReady()) {
      const omToken    = await getOmToken()
      const encodedRef = encodeURIComponent(reference)

      // Essai 1 : endpoint QR v4 (orderId retourné lors de la création du QR)
      try {
        const res = await fetch(
          `${OM_BASE_URL}/api/eWallet/v4/qrcode/${encodedRef}`,
          { headers: { Authorization: `Bearer ${omToken}` } },
        )
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>
          console.log('[verify-terrain] OM v4/qrcode:', JSON.stringify({ status: data.status, statut: data.statut, keys: Object.keys(data) }))
          const st = String(data.status ?? data.statut ?? data.txStatus ?? '').toUpperCase()
          paid = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCESSFULL', 'SUCCESSFUL', 'PAYMENT_SUCCESS'].includes(st)
        }
      } catch { /* ignore, fallback */ }

      // Essai 2 : endpoint v1/transactions (si reference est un transactionId)
      if (!paid) {
        try {
          const res = await fetch(
            `${OM_BASE_URL}/api/eWallet/v1/transactions/${encodedRef}/status`,
            { headers: { Authorization: `Bearer ${omToken}` } },
          )
          if (res.ok) {
            const data = await res.json() as Record<string, unknown>
            console.log('[verify-terrain] OM v1/tx status:', JSON.stringify({ status: data.status, keys: Object.keys(data) }))
            const st = String(data.status ?? '').toUpperCase()
            paid = ['SUCCESS', 'SUCCESSFUL', 'SUCCESSFULL'].includes(st)
          }
        } catch { /* ignore */ }
      }

    } else if (reservationId && isUUID(reservationId)) {
      // Simulation (pas de clés prod) → auto-confirmer pour les tests
      paid = true
    } else {
      return json({ paid: false, status: 'awaiting_keys' })
    }

    // ── Confirmer en DB + déclencher le reversement ───────────────────────────
    if (paid && reservationId && isUUID(reservationId)) {
      const { data: resa } = await supabase
        .from('reservations_terrain')
        .select('client_id, date_reservation, heure_debut, heure_fin, statut, receipt_code, prestataire_id, montant_prestataire, moyen_paiement, terrain_id')
        .eq('id', reservationId)
        .single()

      if (!resa || resa.client_id !== user.id) return json({ error: 'Réservation invalide' }, 403)

      // Idempotence : déjà paye (race webhook + verify)
      if (resa.statut === 'paye') {
        return json({ paid: true, receipt_code: resa.receipt_code })
      }
      if (resa.statut !== 'en_attente') return json({ error: 'Réservation non confirmable' }, 409)

      const receiptCode       = genReceiptCode()
      const heureFin          = (resa.heure_fin as string).slice(0, 5)
      const receiptValidUntil = new Date(`${resa.date_reservation}T${heureFin}:00`).toISOString()

      await supabase
        .from('reservations_terrain')
        .update({
          statut:              'paye',
          receipt_status:      'valide',
          receipt_code:        receiptCode,
          receipt_valid_until: receiptValidUntil,
          payout_statut:       'pending',
        })
        .eq('id', reservationId)
        .eq('statut', 'en_attente')

      // Reversement au prestataire (best-effort — ne bloque jamais la réponse client)
      await triggerTerrainPayout(supabase, {
        reservationId,
        prestataireId:             resa.prestataire_id as string,
        montant:                   resa.montant_prestataire as number,
        moyenPaiement:             (resa.moyen_paiement ?? method) as string,
        WAVE_API_KEY,
        OM_RETAILER_MSISDN,
        OM_RETAILER_PIN_ENCRYPTED,
      })

      // Notification client — paiement confirmé (best-effort)
      try {
        const heureDebut = resa.heure_debut ? String(resa.heure_debut).slice(0, 5) : ''
        const heureFin2  = resa.heure_fin   ? String(resa.heure_fin).slice(0, 5)   : ''
        let terrainNom = 'Terrain'
        if (resa.terrain_id && isUUID(resa.terrain_id as string)) {
          const { data: t } = await supabase.from('terrains').select('nom').eq('id', resa.terrain_id as string).maybeSingle()
          if (t?.nom) terrainNom = t.nom as string
        }
        const creneauStr = heureDebut && heureFin2 ? `${heureDebut} → ${heureFin2}` : ''
        const notifBody  = creneauStr
          ? `Ta réservation de ${terrainNom} · ${creneauStr} est confirmée ✓`
          : `Ta réservation de ${terrainNom} est confirmée ✓`
        await Promise.allSettled([
          sendPushToUser(supabase, resa.client_id as string, {
            title:     'Réservation confirmée ✓',
            body:      notifBody,
            data:      { type: 'reservation_terrain', reservationId },
            channelId: 'commandes',
          }),
          supabase.from('notifications').insert({
            user_id: resa.client_id,
            type:    'reservation_terrain',
            title:   'Réservation confirmée ✓',
            body:    notifBody,
            data:    { type: 'reservation_terrain', reservationId },
          }),
        ])
      } catch { /* best-effort */ }

      return json({ paid: true, receipt_code: receiptCode })
    }

    return json({ paid })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[verify-terrain-payment]', msg)
    return json({ error: msg }, 500)
  }
})
