/**
 * admin-vip-control — Edge Function sécurisée pour le contrôle VIP.
 * Actions disponibles :
 *   - recalculate   : relancer le calcul VIP pour la semaine courante
 *   - set_exclu     : exclure / réintégrer un shop du podium
 *   - get_settings  : lire la config vip_settings
 *   - set_settings  : mettre à jour vip_settings
 *   - get_history   : historique des classements (vip_rankings)
 *   - get_run_log   : journal des exécutions (vip_run_log)
 * Accès admin uniquement.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Vérifier l'identité via JWT utilisateur
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Non autorisé' }, 401)

    // Client service_role pour les écritures sensibles
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Vérifier is_admin côté serveur
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return json({ error: 'Accès refusé — droits admin requis' }, 403)

    const body = await req.json().catch(() => ({}))
    const { action } = body

    // ── Relancer le calcul VIP ──────────────────────────────────────────────
    if (action === 'recalculate') {
      const { data, error } = await admin.rpc('update_vip_rankings', {
        p_run_by: user.id,
      })
      if (error) throw error

      await admin.from('admin_actions_log').insert({
        admin_id: user.id,
        action:   'vip_recalculate',
        details:  { result: data, admin_name: profile.name },
      })

      return json({ ok: true, result: data })
    }

    // ── Exclure / réintégrer un shop ────────────────────────────────────────
    if (action === 'set_exclu') {
      const { shopId, exclu, raison } = body
      if (!shopId) return json({ error: 'shopId requis' }, 400)

      const { error } = await admin
        .from('shops')
        .update({ vip_exclu: Boolean(exclu) })
        .eq('id', shopId)
      if (error) throw error

      // Si on exclut, enlever le VIP auto s'il l'avait
      if (exclu) {
        await admin.from('shops').update({ is_vip: false }).eq('id', shopId)
        // Supprimer ses classements de la semaine courante
        const semaine = new Date().toISOString().slice(0, 4) + '-W' +
          String(getISOWeek(new Date())).padStart(2, '0')
        await admin.from('vip_rankings')
          .delete()
          .eq('shop_id', shopId)
          .eq('semaine', semaine)
      }

      await admin.from('admin_actions_log').insert({
        admin_id:       user.id,
        action:         exclu ? 'vip_exclu_set' : 'vip_exclu_remove',
        target_shop_id: shopId,
        details:        { exclu: Boolean(exclu), raison, admin_name: profile.name },
      })

      return json({ ok: true })
    }

    // ── Lire la config ──────────────────────────────────────────────────────
    if (action === 'get_settings') {
      const { data, error } = await admin
        .from('vip_settings')
        .select('*')
        .eq('id', 1)
        .single()
      if (error) throw error
      return json({ ok: true, settings: data })
    }

    // ── Mettre à jour la config ─────────────────────────────────────────────
    if (action === 'set_settings') {
      const { settings } = body
      if (!settings) return json({ error: 'settings requis' }, 400)

      const allowed = [
        'poids_commandes','poids_ca','poids_note',
        'cap_ca_par_commande','plafond_par_client','taille_podium',
      ]
      const updates: Record<string, number> = {}
      for (const k of allowed) {
        if (settings[k] !== undefined) updates[k] = Number(settings[k])
      }
      updates['updated_by'] = user.id
      updates['updated_at'] = new Date().toISOString()

      const { error } = await admin
        .from('vip_settings')
        .update(updates)
        .eq('id', 1)
      if (error) throw error

      await admin.from('admin_actions_log').insert({
        admin_id: user.id,
        action:   'vip_settings_update',
        details:  { updates, admin_name: profile.name },
      })

      return json({ ok: true })
    }

    // ── Historique des classements ─────────────────────────────────────────
    if (action === 'get_history') {
      const { semaine, limit = 50 } = body
      let query = admin
        .from('vip_rankings')
        .select(`
          semaine, rang, score, source, categorie, created_at,
          shops ( id, name, zone, logo_url, category )
        `)
        .order('semaine', { ascending: false })
        .order('categorie')
        .order('rang')
        .limit(Number(limit))

      if (semaine) query = query.eq('semaine', semaine)

      const { data, error } = await query
      if (error) throw error
      return json({ ok: true, rankings: data })
    }

    // ── Journal des exécutions ─────────────────────────────────────────────
    if (action === 'get_run_log') {
      const { data, error } = await admin
        .from('vip_run_log')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return json({ ok: true, logs: data })
    }

    return json({ error: 'Action inconnue' }, 400)

  } catch (err: any) {
    return json({ error: err.message ?? 'Erreur interne' }, 500)
  }
})

// Calcul ISO week number (JS n'a pas de fonction native)
function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7)
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  return 1 + Math.round(
    ((tmp.getTime() - week1.getTime()) / 86400000
      - 3 + (week1.getDay() + 6) % 7) / 7
  )
}
