// ============================================================
// EDGE FUNCTION : create-beauty-appointment
// Crée une demande de RDV beauté/coiffure (5 Étoiles, sans paiement).
// Sécurité : l'auth est vérifiée, le profil VIP doit être actif.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

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

    const { vipProfilId, timeSlotId, dateRdv, heureDebut, heureFin, prestationNom, noteClient } = body

    // ③ Validation
    if (!isUUID(vipProfilId))  return json({ error: 'vipProfilId invalide' }, 400)
    if (!isUUID(timeSlotId))   return json({ error: 'timeSlotId requis' }, 400)
    if (typeof dateRdv !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateRdv)) {
      return json({ error: 'dateRdv invalide (YYYY-MM-DD)' }, 400)
    }
    if (typeof heureDebut !== 'string' || !/^\d{2}:\d{2}$/.test(heureDebut)) {
      return json({ error: 'heureDebut invalide (HH:MM)' }, 400)
    }
    if (prestationNom && !isSafeString(prestationNom, { maxLen: 200 })) {
      return json({ error: 'prestationNom trop long' }, 400)
    }
    if (noteClient && !isSafeString(noteClient, { maxLen: 500 })) {
      return json({ error: 'noteClient trop long' }, 400)
    }

    // Date dans le futur
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (new Date(dateRdv + 'T00:00:00') < today) {
      return json({ error: 'La date doit être dans le futur' }, 422)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ④ Vérifier que le profil VIP existe et est actif
    const { data: profil, error: profilErr } = await admin
      .from('vip_profils')
      .select('id, nom_affiche, categorie')
      .eq('id', vipProfilId)
      .eq('actif', true)
      .single()

    if (profilErr || !profil) return json({ error: 'Établissement introuvable ou inactif' }, 404)
    if (!['beaute_tressage', 'coiffure'].includes(profil.categorie)) {
      return json({ error: 'Ce module est réservé aux salons de beauté et coiffure' }, 422)
    }

    // ⑤ Vérifier le créneau
    const { data: slot, error: slotErr } = await admin
      .from('beauty_time_slots')
      .select('id, heure_debut, heure_fin, jours_semaine, max_reservations')
      .eq('id', timeSlotId)
      .eq('vip_profil_id', vipProfilId)
      .eq('actif', true)
      .single()

    if (slotErr || !slot) return json({ error: 'Créneau introuvable' }, 404)

    // Vérifier que le créneau est dispo ce jour
    const dayOfWeek = new Date(dateRdv + 'T00:00:00').getDay()
    if (!slot.jours_semaine.includes(dayOfWeek)) {
      return json({ error: 'Ce créneau n\'est pas disponible ce jour' }, 422)
    }

    // Vérifier les places restantes
    const { count } = await admin
      .from('beauty_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('time_slot_id', timeSlotId)
      .eq('date_rdv', dateRdv)
      .not('statut', 'in', '("refuse","annule")')

    if ((count ?? 0) >= slot.max_reservations) {
      return json({ error: 'Ce créneau est complet pour cette date' }, 409)
    }

    // ⑥ Créer le RDV
    const { data: rdv, error: rdvErr } = await admin
      .from('beauty_appointments')
      .insert({
        client_id:      user.id,
        vip_profil_id:  vipProfilId,
        time_slot_id:   timeSlotId,
        prestation_nom: prestationNom ?? null,
        date_rdv:       dateRdv,
        heure_debut:    heureDebut + ':00',
        heure_fin:      heureFin   ? (heureFin + ':00') : slot.heure_fin,
        note_client:    noteClient ?? null,
        statut:         'en_attente',
      })
      .select('id')
      .single()

    if (rdvErr) throw new Error(rdvErr.message)

    return json({ success: true, appointmentId: rdv.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[create-beauty-appointment]', msg)
    return json({ error: msg }, 500)
  }
})
