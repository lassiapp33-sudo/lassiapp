// Shared CORS headers factory
// Usage : const corsHeaders = buildCorsHeaders(req);
export function corsHeaders(_req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
