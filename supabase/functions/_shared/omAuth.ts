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

export async function getOmToken(): Promise<string> {
  const res = await fetch(`${OM_BASE_URL}/oauth/v1/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     OM_CLIENT_ID,
      client_secret: OM_CLIENT_SECRET,
      grant_type:    'client_credentials',
    }).toString(),
  })
  if (!res.ok) throw new Error(`OM auth échoué (${res.status}): ${await res.text()}`)
  const { access_token } = await res.json()
  if (!access_token) throw new Error('OM token absent de la réponse')
  return access_token as string
}

// Vérifie qu'OM est configuré (clés présentes)
export function isOmReady(): boolean {
  return !!(OM_CLIENT_ID && OM_CLIENT_SECRET && (Deno.env.get('OM_MERCHANT_CODE') ?? ''))
}
