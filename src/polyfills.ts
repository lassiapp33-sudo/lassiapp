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
// Requis par @supabase/supabase-js et d'autres libs web-first.
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

if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = class TextDecoder {
    private _encoding: string;
    constructor(encoding = 'utf-8') { this._encoding = encoding; }
    decode(input?: Uint8Array | ArrayBuffer): string {
      const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : (input ?? new Uint8Array());
      let out = '';
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i++];
        if (b < 0x80) {
          out += String.fromCharCode(b);
        } else if ((b & 0xe0) === 0xc0) {
          out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
        } else if ((b & 0xf0) === 0xe0) {
          const c1 = bytes[i++]; const c2 = bytes[i++];
          out += String.fromCharCode(((b & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (c2 & 0x3f));
        } else {
          i += 3;
          out += '�';
        }
      }
      return out;
    }
  };
}
