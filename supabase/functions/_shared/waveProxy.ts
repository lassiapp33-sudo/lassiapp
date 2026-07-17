// Helper : appelle Wave via le proxy Cloudflare si WAVE_PROXY_URL est défini,
// sinon appel direct (legacy, sans proxy).

import { buildWaveSignature } from './waveSign.ts';

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? '';
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')    ?? '';
const WAVE_PROXY_SECRET = Deno.env.get('WAVE_PROXY_SECRET') ?? '';

export async function callWaveCheckout(
  waveBody:       string,
  idempotencyKey: string,
): Promise<Response> {
  if (WAVE_PROXY_URL) {
    // Via proxy Cloudflare → Wave voit l'IP Cloudflare, pas celle de Supabase
    return fetch(WAVE_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Proxy-Secret':  WAVE_PROXY_SECRET,
      },
      body: waveBody,
    });
  }

  // Appel direct Wave (mode sans proxy)
  const headers: Record<string, string> = {
    'Authorization':   `Bearer ${WAVE_API_KEY}`,
    'Content-Type':    'application/json',
    'Idempotency-Key': idempotencyKey,
  };
  const sig = await buildWaveSignature(waveBody);
  if (sig) headers['Wave-Signature'] = sig;

  return fetch('https://api.wave.com/v1/checkout/sessions', {
    method: 'POST',
    headers,
    body:   waveBody,
  });
}
