import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Fonction de diagnostic push — no-verify-jwt activé, pas d'auth requise
// POST /functions/v1/test-push
// Body: { userId?: string }
Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    let targetUserId: string = body.userId ?? ''
    if (!targetUserId) {
      const { data: adminProfile } = await admin
        .from('profiles').select('id').eq('is_admin', true).limit(1).maybeSingle()
      if (!adminProfile) return json({ error: 'Aucun admin trouvé' }, 404)
      targetUserId = adminProfile.id
    }

    // 1. Lister les tokens enregistrés
    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token, platform, updated_at')
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false })

    const tokens = (tokenRows ?? []) as { token: string; platform: string; updated_at: string }[]

    if (tokens.length === 0) {
      return json({
        status: 'no_tokens',
        userId: targetUserId,
        message: 'Aucun token push enregistré. Ouvre le build production (TestFlight/APK) et connecte-toi.',
      })
    }

    // 2. Envoyer un push de test à chaque token
    const EXPO_URL = 'https://exp.host/--/api/v2/push/send'
    const messages = tokens.map(t => ({
      to:        t.token,
      title:     'Test LASSI push ✅',
      body:      `Token ${t.platform} — ${new Date().toLocaleTimeString('fr-FR')}`,
      data:      { type: 'test' },
      sound:     'default',
      channelId: 'commandes',
    }))

    const expoRes = await fetch(EXPO_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    })
    const expoData = await expoRes.json() as { data?: Array<{ status: string; id?: string; message?: string; details?: unknown }> }

    const tickets = expoData?.data ?? []
    const errors  = tickets.filter(t => t.status === 'error')
    const ok      = tickets.filter(t => t.status === 'ok')

    return json({
      status:   errors.length === 0 ? 'sent' : 'partial_errors',
      userId:   targetUserId,
      tokens:   tokens.map(t => ({
        platform:     t.platform,
        token_prefix: t.token.slice(0, 35) + '…',
        updated_at:   t.updated_at,
      })),
      expo_tickets: tickets,
      summary: {
        total:  tickets.length,
        ok:     ok.length,
        errors: errors.length,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[test-push]', msg)
    return json({ error: msg }, 500)
  }
})
