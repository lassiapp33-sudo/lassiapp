// ============================================================
// EDGE FUNCTION : process-beauty-appointment
// Le gérant confirme ou refuse un RDV beauté/coiffure.
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
    // ① Auth gérant
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

    const { appointmentId, action, messageGerant } = body

    if (!isUUID(appointmentId)) return json({ error: 'appointmentId invalide' }, 400)
    if (!['confirmer', 'refuser'].includes(action as string)) {
      return json({ error: 'action invalide (confirmer | refuser)' }, 400)
    }
    if (messageGerant && !isSafeString(messageGerant, { maxLen: 500 })) {
      return json({ error: 'messageGerant trop long' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Vérifier que le RDV appartient à un établissement géré par ce gérant
    const { data: rdv, error: rdvErr } = await admin
      .from('beauty_appointments')
      .select('id, statut, vip_profil_id, client_id, prestation_nom, date_rdv, heure_debut')
      .eq('id', appointmentId)
      .single()

    if (rdvErr || !rdv) return json({ error: 'RDV introuvable' }, 404)
    if (rdv.statut !== 'en_attente') {
      return json({ error: 'Ce RDV a déjà été traité' }, 409)
    }

    const { data: profil } = await admin
      .from('vip_profils')
      .select('gerant_user_id, nom_affiche')
      .eq('id', rdv.vip_profil_id)
      .single()

    if (!profil || profil.gerant_user_id !== user.id) {
      return json({ error: 'Accès refusé' }, 403)
    }

    // ④ Mettre à jour le statut
    const nouveauStatut = action === 'confirmer' ? 'confirme' : 'refuse'

    const { error: updErr } = await admin
      .from('beauty_appointments')
      .update({
        statut:         nouveauStatut,
        message_gerant: messageGerant ?? null,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', appointmentId)

    if (updErr) throw new Error(updErr.message)

    // ⑤ Notifier le client (best-effort)
    try {
      const heureLabel = rdv.heure_debut ? rdv.heure_debut.slice(0, 5) : ''
      const rdvLabel   = rdv.prestation_nom
        ? `${rdv.prestation_nom}${heureLabel ? ` à ${heureLabel}` : ''}`
        : heureLabel ? `RDV à ${heureLabel}` : 'votre rendez-vous'

      await admin.functions.invoke('notify-new-message', {
        body: {
          userId: rdv.client_id,
          title:  action === 'confirmer'
            ? `${profil.nom_affiche} a confirmé votre RDV`
            : `${profil.nom_affiche} n'est pas disponible`,
          body:   action === 'confirmer'
            ? (messageGerant ?? `${rdvLabel} est confirmé — à bientôt`)
            : (messageGerant ?? 'Votre demande de rendez-vous a été refusée.'),
          data:   { type: action === 'confirmer' ? 'rdv_beauty_confirme' : 'rdv_beauty_refuse', appointmentId },
        },
      })
    } catch (_) { /* non bloquant */ }

    return json({ success: true, statut: nouveauStatut })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('[process-beauty-appointment]', msg)
    return json({ error: msg }, 500)
  }
})
