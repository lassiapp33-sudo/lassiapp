// Helper Wave — signature HMAC-SHA256 des requêtes sortantes
//
// Doc : https://api.wave.com — section "Request signing"
// Format header : Wave-Signature: t={timestamp},v1={signature}
// Payload signé : timestamp (entier Unix) + raw body (chaîne exacte envoyée)
//
// Uniquement actif si WAVE_SIGNING_SECRET est configuré.
// Si la clé Wave n'a pas la signature activée, renvoie null et aucun header n'est ajouté.

export async function buildWaveSignature(rawBody: string): Promise<string | null> {
  const secret = Deno.env.get('WAVE_SIGNING_SECRET') ?? '';
  if (!secret) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const payload   = `${timestamp}${rawBody}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `t=${timestamp},v1=${signature}`;
}
