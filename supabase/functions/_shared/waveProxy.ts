// Routes Wave API calls through a fixed-IP proxy (Oracle Cloud VM)
// to satisfy Wave's IP whitelist requirement.
// Falls back to direct call if WAVE_PROXY_URL is not set.

import { buildWaveSignature } from './waveSign.ts';

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? '';
const WAVE_PROXY_BASE   = Deno.env.get('WAVE_PROXY_URL')    ?? ''; // ex: http://152.67.x.x:8080
const WAVE_PROXY_SECRET = Deno.env.get('WAVE_PROXY_SECRET') ?? '';

// Fonction générale — toutes les requêtes Wave passent ici
export async function waveRequest(
  path: string,
  method: string,
  body?: string,
  idempotencyKey?: string,
): Promise<Response> {
  const extraHeaders: Record<string, string> = {};
  if (idempotencyKey) extraHeaders['Idempotency-Key'] = idempotencyKey;
  if (body) {
    const sig = await buildWaveSignature(body);
    if (sig) extraHeaders['Wave-Signature'] = sig;
  }

  if (WAVE_PROXY_BASE) {
    return fetch(`${WAVE_PROXY_BASE}${path}`, {
      method,
      headers: {
        'Content-Type':   'application/json',
        'X-Proxy-Secret': WAVE_PROXY_SECRET,
        ...extraHeaders,
      },
      body: body || undefined,
    });
  }

  return fetch(`https://api.wave.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${WAVE_API_KEY}`,
      'Content-Type':  'application/json',
      ...extraHeaders,
    },
    body: body || undefined,
  });
}

// Raccourci pour la création de session checkout (utilisé dans create-payment etc.)
export async function callWaveCheckout(
  waveBody: string,
  idempotencyKey: string,
): Promise<Response> {
  return waveRequest('/v1/checkout/sessions', 'POST', waveBody, idempotencyKey);
}

// Vérification d'une session checkout
export async function getWaveCheckout(sessionId: string): Promise<Response> {
  return waveRequest(`/v1/checkout/sessions/${sessionId}`, 'GET');
}

// Payout Wave
export async function waveRequestPayout(
  payoutBody: string,
  idempotencyKey: string,
): Promise<Response> {
  return waveRequest('/v1/payout', 'POST', payoutBody, idempotencyKey);
}

// Remboursement Wave
export async function waveRequestRefund(
  sessionId: string,
  refundBody: string,
  idempotencyKey: string,
): Promise<Response> {
  return waveRequest(`/v1/checkout/sessions/${sessionId}/refund`, 'POST', refundBody, idempotencyKey);
}
