// Proxy Cloudflare Workers → Wave API
// Supabase Edge Functions appellent ce Worker avec X-Proxy-Secret.
// Le Worker ajoute l'auth Wave + la signature HMAC, puis forward vers Wave.
// Résultat : Wave voit l'IP Cloudflare (stable), pas celle de Supabase (dynamique).

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifie que l'appelant est bien Supabase (secret partagé)
    const proxySecret = request.headers.get('X-Proxy-Secret');
    if (!proxySecret || proxySecret !== env.INTERNAL_SECRET) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await request.text();

    const waveHeaders: Record<string, string> = {
      'Authorization': `Bearer ${env.WAVE_API_KEY}`,
      'Content-Type':  'application/json',
    };

    // Passe l'Idempotency-Key depuis l'appelant
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) waveHeaders['Idempotency-Key'] = idempotencyKey;

    // Signature HMAC-SHA256 (Wave-Signature) si le secret est configuré
    if (env.WAVE_SIGNING_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload   = `${timestamp}${rawBody}`;
      const encoder   = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(env.WAVE_SIGNING_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const hex = Array.from(new Uint8Array(mac))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      waveHeaders['Wave-Signature'] = `t=${timestamp},v1=${hex}`;
    }

    const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method:  'POST',
      headers: waveHeaders,
      body:    rawBody,
    });

    const responseText = await waveRes.text();
    return new Response(responseText, {
      status:  waveRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

interface Env {
  WAVE_API_KEY:       string; // clé Wave Business
  WAVE_SIGNING_SECRET: string; // secret signature Wave (optionnel)
  INTERNAL_SECRET:    string; // secret partagé avec Supabase
}
