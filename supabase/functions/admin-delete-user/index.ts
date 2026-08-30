/**
 * admin-delete-user — Suppression définitive d'un compte par un admin.
 * Vérifie is_admin, purge toutes les données liées, log l'action, puis
 * supprime l'entrée Supabase Auth via service_role.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString } from '../_shared/validation.ts'
import { logAuditEvent } from '../_shared/audit.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Vérifier l'identité de l'appelant ──────────────────────────────────
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Vérifier is_admin via service_role (incorruptible) ─────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: adminProfile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', caller.id)
      .single()

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé — droits admin requis' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Lire le targetUserId depuis le body ────────────────────────────────
    const { targetUserId, reason } = await req.json()

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'targetUserId requis' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (!isUUID(targetUserId)) {
      return new Response(JSON.stringify({ error: 'targetUserId invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (reason !== undefined && reason !== null && !isSafeString(reason, { maxLen: 500 })) {
      return new Response(JSON.stringify({ error: 'reason trop longue (500 caractères max)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Empêcher un admin de se supprimer lui-même via cette route
    if (targetUserId === caller.id) {
      return new Response(JSON.stringify({ error: 'Impossible de supprimer son propre compte via cette route.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Récupérer le profil cible (pour le log + guard admin) ─────────────
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('name, phone, role, is_admin')
      .eq('id', targetUserId)
      .maybeSingle()

    // Empêcher la suppression d'un autre compte admin (escalade de privilèges)
    if (targetProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Impossible de supprimer un compte administrateur.' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 4b. Refuser si des reversements sont en attente (H6) ─────────────────
    const { count: pendingPayouts } = await admin
      .from('payout_queue')
      .select('id', { count: 'exact', head: true })
      .eq('prestataire_id', targetUserId)
      .in('statut', ['queued', 'processing'])

    if (pendingPayouts && pendingPayouts > 0) {
      return new Response(JSON.stringify({
        error: `Impossible de supprimer ce compte : ${pendingPayouts} reversement(s) en attente (queued/processing). Attendez leur résolution ou annulez-les manuellement.`,
      }), { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // ── 5. Logger AVANT suppression (service_role contourne les RLS) ──────────
    await admin.from('admin_actions_log').insert({
      admin_id:       caller.id,
      action:         'delete_user',
      target_user_id: targetUserId,
      details: {
        reason:       reason ?? 'Aucune raison fournie',
        target_name:  targetProfile?.name ?? '—',
        target_phone: targetProfile?.phone ?? '—',
        target_role:  targetProfile?.role ?? '—',
        admin_name:   adminProfile.name,
      },
    })

    await logAuditEvent(admin, {
      action:      'admin_delete_user',
      targetTable: 'profiles',
      targetId:    targetUserId,
      before:      targetProfile ?? null,
      metadata:    { reason: reason ?? 'Aucune raison fournie' },
      actorId:     caller.id,
      actorRole:   'admin',
    })

    // ── 6. Purger toutes les données liées via fonction SECURITY DEFINER ────────
    // La fonction SQL admin_purge_user_data gère l'ordre exact des suppressions
    // et contourne les échecs de check RI que le client JS service_role ne peut
    // pas résoudre (ex: payment_logs "gave unexpected result").
    const { error: purgeErr } = await admin.rpc('admin_purge_user_data', {
      p_user_id: targetUserId,
    })
    if (purgeErr) throw new Error(`Purge données impossible : ${purgeErr.message}`)

    // ── 7. Supprimer le compte Supabase Auth ──────────────────────────────────
    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId)
    if (deleteErr) throw deleteErr

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
