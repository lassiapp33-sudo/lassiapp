// Polyfills chargés au tout début de l'app.
// Hermes (React Native) n'implémente pas toutes les APIs web — on les ajoute ici.

// ── DOMException ──────────────────────────────────────────────────────────────
// Utilisé par @supabase/supabase-js et d'autres libs web-first.
if (typeof global.DOMException === 'undefined') {
  // @ts-ignore
  global.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}

// ── TextEncoder / TextDecoder ─────────────────────────────────────────────────
// Requis par certaines versions de @supabase/supabase-js.
if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const bytes: number[] = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else {
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return new Uint8Array(bytes);
    }
  };
}
