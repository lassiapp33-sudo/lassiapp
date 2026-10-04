// Utilitaires de validation partagés entre les Edge Functions

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isPositiveInt(v: unknown, max = 99): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= max;
}

interface SafeStringOptions {
  maxLen?: number;
  pattern?: RegExp;
}

export function isSafeString(v: unknown, opts: SafeStringOptions = {}): v is string {
  if (typeof v !== 'string' || v.trim().length === 0) return false;
  if (opts.maxLen && v.length > opts.maxLen) return false;
  if (opts.pattern && !opts.pattern.test(v)) return false;
  return true;
}
