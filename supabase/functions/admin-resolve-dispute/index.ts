/**
 * admin-resolve-dispute — Edge Function sécurisée pour l'arbitrage des litiges.
 * Seul un is_admin peut changer le statut et écrire la résolution.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Vérifier is_admin
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé — droits admin requis' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { disputeId, status, resolution, message } = await req.json()

    if (!disputeId || !status || !resolution) {
      return new Response(JSON.stringify({ error: 'disputeId, status, resolution requis' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const validStatuses = ['open', 'in_review', 'resolved', 'rejected']
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Statut invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Mettre à jour le litige
    const { error: updateErr } = await admin
      .from('disputes')
      .update({
        status,
        resolution,
        resolved_by: user.id,
        resolved_at: ['resolved', 'rejected'].includes(status) ? new Date().toISOString() : null,
      })
      .eq('id', disputeId)

    if (updateErr) throw updateErr

    // Ajouter un message admin si fourni
    if (message?.trim()) {
      await admin.from('dispute_messages').insert({
        dispute_id:  disputeId,
        sender_id:   user.id,
        sender_role: 'admin',
        message:     message.trim(),
      })
    }

    // Journaliser l'action
    await admin.from('admin_actions_log').insert({
      admin_id:  user.id,
      action:    'resolve_dispute',
      details: {
        dispute_id:  disputeId,
        new_status:  status,
        resolution,
        admin_name:  profile.name,
      },
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
