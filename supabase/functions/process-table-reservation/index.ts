// ============================================================
// EDGE FUNCTION : process-table-reservation
// Permet au gérant d'un restaurant 5 Étoiles de traiter une demande :
//   - accepter  → génère le QR code du ticket client
//   - refuser   → marque pour remboursement acompte
//   - alternative → propose un autre créneau / espace / date
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

const ACTIONS_VALIDES = ['accepter', 'refuser', 'proposer_alternative'] as const
type Action = typeof ACTIONS_VALIDES[number]

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
      reservationId,
      action,
      messageGerant,
      altSpaceId,
      altDate,
      altHeureDebut,
      altMessage,
    } = body

    if (!isUUID(reservationId))                          return json({ error: 'reservationId invalide' }, 400)
    if (!ACTIONS_VALIDES.includes(action as Action))     return json({ error: 'action invalide' }, 400)
    if (messageGerant && !isSafeString(messageGerant, { maxLen: 1000 })) return json({ error: 'message trop long' }, 400)

    // Validation des champs alternative
    if (action === 'proposer_alternative') {
      if (altDate && !/^\d{4}-\d{2}-\d{2}$/.test(altDate as string)) return json({ error: 'altDate invalide' }, 400)
      if (altHeureDebut && !/^\d{2}:\d{2}$/.test(altHeureDebut as string)) return json({ error: 'altHeureDebut invalide' }, 400)
      if (altSpaceId && !isUUID(altSpaceId)) return json({ error: 'altSpaceId invalide' }, 400)
      if (altMessage && !isSafeString(altMessage, { maxLen: 1000 })) return json({ error: 'altMessage trop long' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Charger la réservation
    const { data: resa, error: resaError } = await admin
      .from('table_reservations')
      .select('id, statut, paiement_statut, vip_profil_id, client_id, paiement_ref, acompte_montant, date_reservation, heure_debut, nb_personnes, motif')
      .eq('id', reservationId)
      .single()

    if (resaError || !resa) return json({ error: 'Réservation introuvable' }, 404)

    // ④ Vérifier que l'utilisateur est le gérant de CE restaurant
    const { data: profil } = await admin
      .from('vip_profils')
      .select('id, nom_affiche, gerant_user_id')
      .eq('id', resa.vip_profil_id)
      .single()

    if (!profil || profil.gerant_user_id !== user.id) {
      return json({ error: 'Non autorisé : vous n\'êtes pas le gérant de ce restaurant' }, 403)
    }

    // ⑤ Vérifier que le paiement est confirmé
    if (resa.paiement_statut !== 'paye') {
      return json({ error: 'Paiement non confirmé — impossible de traiter cette réservation' }, 422)
    }

    // ⑥ Vérifier que la réservation est bien en attente de traitement
    if (resa.statut !== 'en_attente') {
      return json({ error: `Réservation déjà traitée (statut : ${resa.statut})` }, 409)
    }

    // ⑥ Traitement selon l'action
    if (action === 'accepter') {
      // Générer un QR code unique lisible
      const qrCode = `RESA-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

      await admin
        .from('table_reservations')
        .update({
          statut:        'acceptee',
          message_gerant: messageGerant ?? null,
          qr_code:       qrCode,
        })
        .eq('id', reservationId)

      // Ré-activer le payout (3 000 FCFA → gérant) suspendu depuis la confirmation du paiement
      if (resa.paiement_ref) {
        await admin
          .from('payout_queue')
          .update({ statut: 'queued', prestataire_id: profil.gerant_user_id })
          .eq('payment_intent_id', resa.paiement_ref)
          .eq('statut', 'cancelled');
      }

      // Notification client (best-effort)
      try {
        await admin.functions.invoke('notify-new-message', {
          body: {
            userId:  resa.client_id,
            title:   `${profil.nom_affiche} a accepté votre réservation`,
            body:    messageGerant ?? 'Votre table est confirmée. Présentez votre ticket à l\'arrivée.',
            data:    { type: 'reservation_acceptee', reservationId },
          },
        })
      } catch (_) { /* notification non bloquante */ }

      return json({ success: true, action: 'acceptee', qrCode })
    }

    if (action === 'refuser') {
      await admin
        .from('table_reservations')
        .update({
          statut:         'refusee',
          message_gerant: messageGerant ?? null,
        })
        .eq('id', reservationId)

      // Déclencher le remboursement de l'acompte
      if (resa.paiement_ref) {
        try {
          await admin.functions.invoke('refund', {
            body: { paymentIntentId: resa.paiement_ref },
          })
        } catch (_) {
          console.error('[process-table-reservation] refund failed for pi:', resa.paiement_ref)
        }
      }

      // Notification client (best-effort)
      try {
        await admin.functions.invoke('notify-new-message', {
          body: {
            userId: resa.client_id,
            title:  `${profil.nom_affiche} ne peut pas vous recevoir`,
            body:   messageGerant ?? 'Votre réservation a été refusée. L\'acompte sera remboursé.',
            data:   { type: 'reservation_refusee', reservationId },
          },
        })
      } catch (_) { /* non bloquant */ }

      return json({ success: true, action: 'refusee' })
    }

    if (action === 'proposer_alternative') {
      await admin
        .from('table_reservations')
        .update({
          statut:          'alternative_proposee',
          message_gerant:  messageGerant ?? null,
          alt_space_id:    altSpaceId ?? null,
          alt_date:        altDate    ?? null,
          alt_heure_debut: altHeureDebut ? (altHeureDebut + ':00') : null,
          alt_message:     altMessage ?? null,
        })
        .eq('id', reservationId)

      // Notification client (best-effort)
      const altDetails = [
        altDate        ? `Date : ${altDate}` : null,
        altHeureDebut  ? `Heure : ${altHeureDebut}` : null,
      ].filter(Boolean).join(' · ')

      try {
        await admin.functions.invoke('notify-new-message', {
          body: {
            userId: resa.client_id,
            title:  `${profil.nom_affiche} vous propose une alternative`,
            body:   altDetails || altMessage || 'Le restaurant vous propose un autre créneau.',
            data:   { type: 'reservation_alternative', reservationId },
          },
        })
      } catch (_) { /* non bloquant */ }

      return json({ success: true, action: 'alternative_proposee' })
    }

    return json({ error: 'Action non gérée' }, 400)

  } catch (err) {
    console.error('[process-table-reservation]', err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
