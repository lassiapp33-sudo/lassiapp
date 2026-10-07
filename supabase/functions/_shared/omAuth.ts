// Helper partagé — OAuth2 Orange Money Sonatel
//
// API : https://api.sandbox.orange-sonatel.com  (sandbox)
//       https://api.orange-sonatel.com           (prod)
//
// Différences critiques vs l'ancien api.orange.com :
//   - URL du token : /oauth/v1/token  (non /oauth/v3/token)
//   - Auth         : params dans le body form-urlencoded  (non Basic Auth)

export const OM_BASE_URL = Deno.env.get('OM_BASE_URL') ?? 'https://api.sandbox.orange-sonatel.com'

const OM_CLIENT_ID     = Deno.env.get('OM_CLIENT_ID')     ?? ''
const OM_CLIENT_SECRET = Deno.env.get('OM_CLIENT_SECRET') ?? ''

// Cache module-level — persiste entre les invocations à chaud (warm instances Deno EF).
// Expire 5min avant la fin réelle du token (3600s) pour éviter les 401 en fin de vie.
let _omTokenCache: { token: string; expiresAt: number } | null = null

export async function getOmToken(): Promise<string> {
  const now = Date.now()
  if (_omTokenCache && _omTokenCache.expiresAt > now) {
    return _omTokenCache.token
  }

  const basicAuth = btoa(`${OM_CLIENT_ID}:${OM_CLIENT_SECRET}`)
  const res = await fetch(`${OM_BASE_URL}/oauth/v1/token`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[OM] token error:', body)
    throw new Error(`OM auth échoué (${res.status}): ${body}`)
  }
  const json = await res.json()
  const { access_token, expires_in } = json as { access_token: string; expires_in?: number }
  if (!access_token) throw new Error('OM token absent de la réponse')

  // TTL token OM = expires_in (défaut 3600s) − 5min de marge
  const ttlMs = ((expires_in ?? 3600) - 300) * 1000
  _omTokenCache = { token: access_token, expiresAt: now + ttlMs }

  return access_token
}

// Vérifie qu'OM est configuré (clés présentes)
export function isOmReady(): boolean {
  return !!(OM_CLIENT_ID && OM_CLIENT_SECRET && (Deno.env.get('OM_MERCHANT_CODE') ?? ''))
}
