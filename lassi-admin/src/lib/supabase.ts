import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquants dans .env')
}

// Timeout 15s sur les requêtes data — EXCLU pour /auth/ (refresh token silencieux)
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url
  if (url.includes('/auth/')) return fetch(input, init)
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(url, key, {
  auth: {
    detectSessionInUrl: true,
    persistSession:     true,
    autoRefreshToken:   true,
  },
  global: { fetch: fetchWithTimeout },
})
