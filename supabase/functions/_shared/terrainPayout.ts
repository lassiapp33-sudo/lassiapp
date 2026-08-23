// ─── Reversement terrain — fonction centralisée ───────────────────────────────
// Gère Wave et OM Cash In, met à jour payout_statut en DB, ne bloque jamais le client.
// Idempotency key : tp_{reservationId} — sûr à appeler plusieurs fois.
// La notification prestataire ("à valider") est émise ICI après succès payout,
// jamais depuis les webhook handlers (garantie que l'argent est bien parti).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getOmToken, OM_BASE_URL } from './omAuth.ts'
import { buildWaveSignature } from './waveSign.ts'
import { sendPushToUser } from './push.ts'

const PHONE_RE = /^7[05678][0-9]{7}$/

export interface TerrainPayoutParams {
  reservationId:          string
  prestataireId:          string
  montant:                number
  moyenPaiement:          string
  WAVE_API_KEY:           string
  OM_RETAILER_MSISDN:     string
  OM_RETAILER_PIN_ENCRYPTED: string
}

export async function triggerTerrainPayout(
  supabase: ReturnType<typeof createClient>,
  params: TerrainPayoutParams,
): Promise<void> {
  const tag = `[terrain-payout] reservation=${params.reservationId}`
  try {
    // ── 1. Téléphone prestataire ─────────────────────────────────────────────
    const { data: profil } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', params.prestataireId)
      .maybeSingle()

    let phone = ((profil?.phone ?? '') as string).trim().replace(/^(\+221|00221|221)/, '')

    // Fallback : auth.users (si profiles.phone absent ou mal formaté)
    if (!PHONE_RE.test(phone)) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(params.prestataireId)
        const rawPhone = authData.user?.phone ?? ''
        // E.164 → 9 chiffres locaux
        phone = rawPhone.replace(/^\+221/, '').replace(/^221/, '').replace(/^\+/, '').trim()
      } catch { /* ignore */ }
    }

    if (!PHONE_RE.test(phone)) {
      const msg = `numéro prestataire invalide (len=${phone.length})`
      console.error(`${tag} ERREUR: ${msg}`)
      await supabase.from('reservations_terrain').update({
        payout_statut: 'erreur',
        payout_erreur: msg,
      }).eq('id', params.reservationId).neq('payout_statut', 'ok')
      return
    }

    // ── 2. Idempotency key (max 50 chars — limite OM Cash In) ───────────────
    // tp_ (3) + uuid (36) = 39 chars ✓
    const idempKey = `tp_${params.reservationId}`
    let ref: string

    // ── 3. Appel API ─────────────────────────────────────────────────────────
    if (params.moyenPaiement === 'wave' && params.WAVE_API_KEY) {
      const body = JSON.stringify({
        currency:         'XOF',
        receive_amount:   String(params.montant),
        mobile:           `+221${phone}`,
        client_reference: idempKey,
      })
      const headers: Record<string, string> = {
        'Authorization':   `Bearer ${params.WAVE_API_KEY}`,
        'Content-Type':    'application/json',
        'Idempotency-Key': idempKey,
      }
      const sig = await buildWaveSignature(body)
      if (sig) headers['Wave-Signature'] = sig
      const res  = await fetch('https://api.wave.com/v1/payout', { method: 'POST', headers, body })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error(`Wave payout HTTP ${res.status}: ${JSON.stringify(data)}`)
      if (data.status === 'failed' || data.payout_error) {
        throw new Error(`Wave payout failed: ${JSON.stringify(data.payout_error ?? data)}`)
      }
      ref = (data.id as string) ?? idempKey

    } else if (params.OM_RETAILER_MSISDN && params.OM_RETAILER_PIN_ENCRYPTED) {
      const omToken = await getOmToken()
      const res = await fetch(`${OM_BASE_URL}/api/eWallet/v1/cashins`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${omToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner:  { idType: 'MSISDN', id: params.OM_RETAILER_MSISDN, encryptedPinCode: params.OM_RETAILER_PIN_ENCRYPTED },
          customer: { idType: 'MSISDN', id: phone },
          amount:   { value: params.montant, unit: 'XOF' },
          reference:           idempKey,
          receiveNotification: false,
        }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error(`OM Cash In HTTP ${res.status}: ${data.detail ?? JSON.stringify(data)}`)
      ref = (data.transactionId ?? data.requestId ?? idempKey) as string

    } else {
      // Simulation (pas de clés prod configurées)
      console.log(`${tag} simulation — pas de clés prod, payout ignoré`)
      ref = `SIM-${params.reservationId.slice(0, 8)}`
    }

    // ── 4. Succès → mise à jour DB ───────────────────────────────────────────
    await supabase.from('reservations_terrain').update({
      payout_statut: 'ok',
      payout_ref:    ref,
      payout_at:     new Date().toISOString(),
      payout_erreur: null,
    }).eq('id', params.reservationId)

    console.log(`${tag} OK ref=${ref} montant=${params.montant} moyen=${params.moyenPaiement}`)

    // ── 5. Notification prestataire — UNIQUEMENT après payout réussi ─────────
    // Garantit que le prestataire a bien reçu son argent avant d'être invité à valider.
    try {
      const { data: resa } = await supabase
        .from('reservations_terrain')
        .select('terrain_id, heure_debut, heure_fin, date_reservation, terrains(nom)')
        .eq('id', params.reservationId)
        .maybeSingle()

      const terrainId  = (resa?.terrain_id as string | undefined) ?? ''
      const terrainNom = ((resa?.terrains as { nom?: string } | null)?.nom) ?? 'Terrain'
      const heureDebut = resa?.heure_debut ? String(resa.heure_debut).slice(0, 5) : ''
      const heureFin   = resa?.heure_fin   ? String(resa.heure_fin).slice(0, 5)   : ''
      const creneauStr = heureDebut && heureFin ? `${heureDebut} → ${heureFin}` : ''
      const notifBody  = creneauStr
        ? `${terrainNom} · ${creneauStr} — validez l'accès du client à son arrivée`
        : `${terrainNom} — validez l'accès du client à son arrivée`

      await Promise.allSettled([
        sendPushToUser(supabase, params.prestataireId, {
          title:     'Nouvelle réservation à valider 🏟',
          body:      notifBody,
          data:      { type: 'reservation_terrain', reservationId: params.reservationId, terrainId },
          channelId: 'commandes',
        }),
        supabase.from('notifications').insert({
          user_id: params.prestataireId,
          type:    'reservation_terrain',
          title:   'Nouvelle réservation à valider',
          body:    notifBody,
          data:    { type: 'reservation_terrain', reservationId: params.reservationId, terrainId },
        }),
      ])
      console.log(`${tag} notif prestataire envoyée`)
    } catch (notifErr) {
      // best-effort — le payout a réussi, on ne rejette pas pour une notif
      console.error(`${tag} notif prestataire erreur:`, notifErr instanceof Error ? notifErr.message : notifErr)
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`${tag} ERREUR PAYOUT:`, msg)
    // Stocker l'erreur pour diagnostic et retry ultérieur — ne bloque pas le client
    await supabase.from('reservations_terrain').update({
      payout_statut: 'erreur',
      payout_erreur: msg,
    }).eq('id', params.reservationId).neq('payout_statut', 'ok').catch(() => {})
  }
}
