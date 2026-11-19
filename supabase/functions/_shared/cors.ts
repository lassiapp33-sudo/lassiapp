// ============================================================
// _shared/cors.ts
// Section 9 — Protections réseau : CORS strict + en-têtes de sécurité
//
// Seuls les domaines LASSI (dashboard admin) peuvent lire les réponses des
// Edge Functions depuis un navigateur. Liste configurable via la variable
// d'environnement ALLOWED_ORIGINS (origines séparées par des virgules,
// voir .env.example) ; à défaut, seules les origines de développement local
// sont autorisées.
//
// Important : CORS est une protection NAVIGATEUR uniquement. L'app mobile
// (Expo/React Native) et les webhooks Wave/OM n'envoient pas d'en-tête
// Origin et ne sont pas concernés — leur protection vient du JWT Supabase
// (passerelle verify_jwt) ou de la signature HMAC propre à chaque fonction.
// ============================================================

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
];

const CONFIGURED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = CONFIGURED_ORIGINS.length > 0 ? CONFIGURED_ORIGINS : DEFAULT_ORIGINS;

/**
 * En-têtes CORS + sécurité communs à toutes les Edge Functions appelables
 * depuis un navigateur (dashboard admin lassi-admin).
 *
 * - Access-Control-Allow-Origin : reflète l'Origin de la requête UNIQUEMENT
 *   si elle figure dans ALLOWED_ORIGINS, sinon retombe sur la première
 *   origine autorisée (sans effet pour les appels non-navigateur, qui
 *   n'envoient pas d'en-tête Origin et ne sont pas soumis à CORS).
 * - Vary: Origin : empêche un cache de servir la réponse calculée pour une
 *   origine à une autre origine.
 * - X-Content-Type-Options / Referrer-Policy : durcissement standard des
 *   réponses JSON.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}
