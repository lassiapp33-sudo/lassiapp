/**
 * update-vip-rankings — Edge Function déclenchée par pg_cron ou l'admin.
 * Appelle update_vip_rankings() côté DB (calcul 100% serveur).
 * Sécurisée par CRON_SECRET (pour le cron) ou JWT admin (pour le déclenchement manuel).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')
  let runBy = 'cron'

  // Accepter soit le CRON_SECRET (tâche planifiée), soit un JWT admin
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    runBy = 'cron'
  } else {
    // Vérifier si c'est un admin authentifié
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin requis' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    runBy = user.id
  }

  const { data, error } = await supabase.rpc('update_vip_rankings', {
    p_run_by: runBy,
  })

  if (error) {
    console.error('VIP ranking error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  console.log('VIP rankings result:', data)
  return new Response(
    JSON.stringify({ success: true, updatedAt: new Date().toISOString(), result: data }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
