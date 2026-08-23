import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Diagnostic push — stocke l'état de l'enregistrement token côté device
// POST /functions/v1/push-log  (no-verify-jwt)
// Body: { userId, platform, status, token_prefix?, error? }
Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error } = await admin.from('push_log').insert({
      user_id:      body.userId ?? null,
      platform:     body.platform ?? 'unknown',
      status:       body.status ?? 'unknown',
      token_prefix: body.token_prefix ?? null,
      error_msg:    body.error ?? null,
      created_at:   new Date().toISOString(),
    })

    if (error) console.error('[push-log] insert error:', error.message)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[push-log]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
