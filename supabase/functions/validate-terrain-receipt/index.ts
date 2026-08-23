import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { sendPushToUser } from '../_shared/push.ts'

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
    // ── Auth prestataire ──────────────────────────────────────────────────────
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    const { receiptCode } = await req.json()
    if (!receiptCode || !isSafeString(receiptCode, { maxLen: 12, pattern: /^[A-Z0-9]+$/ })) {
      return json({ error: 'Code invalide' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Validation via RPC (atomique — vérifie ownership + statut + validité) ─
    const { data: result, error: rpcError } = await supabase.rpc('verify_terrain_receipt', {
      p_receipt_code:    receiptCode.toUpperCase(),
      p_prestataire_id:  user.id,
    })

    if (rpcError) {
      console.error('[validate-terrain-receipt] RPC erreur:', rpcError.message)
      return json({ success: false, error: rpcError.message }, 200)
    }

    const res = result as Record<string, unknown>
    if (!res.success) {
      return json({ success: false, error: res.error ?? 'Code invalide ou expiré' })
    }

    // ── Notifications après validation réussie ────────────────────────────────
    const clientId      = res.client_id as string | undefined
    const terrainId     = res.terrain_id as string | undefined
    const heureDebut    = String(res.heure_debut ?? '').slice(0, 5)
    const heureFin      = String(res.heure_fin ?? '').slice(0, 5)
    const dateResa      = String(res.date_reservation ?? '')

    console.log('[validate-terrain-receipt] RPC OK → clientId=', clientId, 'terrainId=', terrainId, 'prestataireId=', user.id)

    // Récupérer le nom du terrain
    let terrainNom = 'Terrain'
    if (terrainId && isUUID(terrainId)) {
      const { data: t, error: tErr } = await supabase.from('terrains').select('nom').eq('id', terrainId).maybeSingle()
      if (tErr) console.error('[validate-terrain-receipt] fetch terrain erreur:', tErr.message)
      if (t?.nom) terrainNom = t.nom as string
    }
    console.log('[validate-terrain-receipt] terrainNom=', terrainNom)

    const creneauStr = heureDebut && heureFin ? `${heureDebut} → ${heureFin}` : ''

    // Notification client : accès validé
    if (clientId && isUUID(clientId)) {
      const notifBody = creneauStr
        ? `Ton accès pour ${terrainNom} (${creneauStr}) a été validé ✓`
        : `Ton accès pour ${terrainNom} a été validé ✓`

      // Push
      const { data: clientTokens } = await supabase.from('push_tokens').select('token').eq('user_id', clientId)
      console.log('[validate-terrain-receipt] client tokens=', (clientTokens ?? []).length)

      const clientResults = await Promise.allSettled([
        sendPushToUser(supabase, clientId, {
          title:     'Accès validé ✓',
          body:      notifBody,
          data:      { type: 'terrain_acces_valide', terrainId, dateResa },
          channelId: 'commandes',
        }),
        supabase.from('notifications').insert({
          user_id: clientId,
          type:    'reservation_terrain',
          title:   'Accès validé ✓',
          body:    notifBody,
          data:    { type: 'terrain_acces_valide', terrainId, dateResa },
        }),
      ])
      const notifInsertClient = clientResults[1]
      if (notifInsertClient.status === 'rejected') {
        console.error('[validate-terrain-receipt] notifications insert client ERREUR:', notifInsertClient.reason)
      } else {
        const v = notifInsertClient.value as { error?: { message?: string } }
        if (v?.error) console.error('[validate-terrain-receipt] notifications insert client DB erreur:', v.error.message)
        else console.log('[validate-terrain-receipt] notifications insert client OK')
      }
    } else {
      console.warn('[validate-terrain-receipt] clientId absent ou invalide — pas de notif client')
    }

    // Notification prestataire : confirmation validation
    {
      const notifBody = creneauStr
        ? `Accès validé pour ${terrainNom} · ${creneauStr}`
        : `Accès validé — ${terrainNom}`

      const { data: prestTokens } = await supabase.from('push_tokens').select('token').eq('user_id', user.id)
      console.log('[validate-terrain-receipt] prestataire tokens=', (prestTokens ?? []).length)

      const prestResults = await Promise.allSettled([
        sendPushToUser(supabase, user.id, {
          title:     'Validation confirmée ✓',
          body:      notifBody,
          data:      { type: 'terrain_acces_valide', terrainId, dateResa },
          channelId: 'commandes',
        }),
        supabase.from('notifications').insert({
          user_id: user.id,
          type:    'reservation_terrain',
          title:   'Validation confirmée ✓',
          body:    notifBody,
          data:    { type: 'terrain_acces_valide', terrainId, dateResa },
        }),
      ])
      const notifInsertPrest = prestResults[1]
      if (notifInsertPrest.status === 'rejected') {
        console.error('[validate-terrain-receipt] notifications insert prestataire ERREUR:', notifInsertPrest.reason)
      } else {
        const v = notifInsertPrest.value as { error?: { message?: string } }
        if (v?.error) console.error('[validate-terrain-receipt] notifications insert prestataire DB erreur:', v.error.message)
        else console.log('[validate-terrain-receipt] notifications insert prestataire OK')
      }
    }

    console.log('[validate-terrain-receipt] OK code=', receiptCode, 'clientId=', clientId)

    return json({
      success:          true,
      client_id:        res.client_id,
      terrain_id:       res.terrain_id,
      heure_debut:      res.heure_debut,
      heure_fin:        res.heure_fin,
      date_reservation: res.date_reservation,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[validate-terrain-receipt]', msg)
    return json({ success: false, error: msg }, 500)
  }
})
