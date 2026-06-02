/**
 * admin-set-featured — Edge Function sécurisée pour la mise en avant manuelle.
 * Seul un compte avec is_admin = true peut appeler cette fonction.
 * vip_manual / featured_manual ne peuvent JAMAIS être modifiés depuis l'app mobile.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Créer un client avec le JWT de l'utilisateur
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    // Vérifier l'identité
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Vérifier is_admin côté serveur
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

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

    // Extraire les paramètres
    const {
      shopId,
      vipManual,
      vipUntil,
      vipExclu,
      featuredManual,
      featuredUntil,
      note,
    } = await req.json()

    if (!shopId) {
      return new Response(JSON.stringify({ error: 'shopId requis' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Construire les mises à jour
    const updates: Record<string, any> = {}
    if (vipManual      !== undefined) updates.vip_manual            = vipManual
    if (vipUntil       !== undefined) updates.vip_manual_until      = vipUntil
    if (vipExclu       !== undefined) updates.vip_exclu             = vipExclu
    if (featuredManual !== undefined) updates.featured_manual       = featuredManual
    if (featuredUntil  !== undefined) updates.featured_manual_until = featuredUntil
    if (note           !== undefined) updates.manual_note           = note

    // Si on exclut, retirer aussi le VIP auto
    if (vipExclu === true) {
      updates.is_vip     = false
      updates.vip_manual = false
    }

    // Mettre à jour le commerce
    const { error: updateErr } = await admin
      .from('shops')
      .update(updates)
      .eq('id', shopId)

    if (updateErr) throw updateErr

    // Journaliser l'action admin
    await admin.from('admin_actions_log').insert({
      admin_id:       user.id,
      action:         'set_featured_manual',
      target_shop_id: shopId,
      details: {
        vip_manual:       vipManual,
        vip_until:        vipUntil,
        vip_exclu:        vipExclu,
        featured_manual:  featuredManual,
        featured_until:   featuredUntil,
        note,
        admin_name:       profile.name,
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
