// Fonction temporaire — setup OM : webhook, clé RSA, changement PIN, chiffrement
// À SUPPRIMER après utilisation
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getOmToken, OM_BASE_URL } from '../_shared/omAuth.ts';
// node-forge : RSA PKCS1v1.5 (standard utilisé par OM Sonatel API)
import forge from 'npm:node-forge@1.3.1';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? '';
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? '';
const OM_RETAILER_MSISDN = Deno.env.get('OM_RETAILER_MSISDN') ?? '770926843';
const SETUP_SECRET      = Deno.env.get('CRON_SECRET')        ?? '';

const CALLBACK_URL =
  `${SUPABASE_URL}/functions/v1/webhook-payment` +
  `?source=om&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;

// Chiffrement RSA PKCS1v1.5 via node-forge (standard OM Sonatel API)
function encryptPin(pin: string, rsaPublicKeyB64: string): string {
  // Construire un PEM depuis la clé SPKI base64
  const pem = [
    '-----BEGIN PUBLIC KEY-----',
    ...(rsaPublicKeyB64.match(/.{1,64}/g) ?? []),
    '-----END PUBLIC KEY-----',
  ].join('\n');
  const publicKey = forge.pki.publicKeyFromPem(pem);
  // RSA PKCS1v1.5 (RSA/ECB/PKCS1Padding en Java) — format attendu par OM Sonatel
  const encrypted = (publicKey as forge.pki.rsa.PublicKey).encrypt(pin, 'RSAES-PKCS1-V1_5');
  return forge.util.encode64(encrypted);
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text || text.trim() === '') return { status: res.status, body: '(empty)' };
  try { return JSON.parse(text); } catch { return { status: res.status, raw: text }; }
}

serve(async (req) => {
  if (req.headers.get('X-Setup-Secret') !== SETUP_SECRET) {
    return new Response('Non autorisé', { status: 401 });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'check';

  try {
    const token   = await getOmToken();
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const results: Record<string, unknown> = { action, callbackUrl: CALLBACK_URL };

    // ── Récupérer la clé RSA prod (toujours) ────────────────────────────────
    const rsaRes = await fetch(`${OM_BASE_URL}/api/account/v1/publicKeys`, { headers });
    const rsaData = await safeJson(rsaRes) as Record<string, unknown>;
    results.rsa_key = rsaData;
    const rsaKey = rsaData.key as string | undefined;

    // ── CHECK ────────────────────────────────────────────────────────────────
    if (action === 'check') {
      const getRes = await fetch(
        `${OM_BASE_URL}/api/notification/v1/merchantcallback?code=${encodeURIComponent(OM_MERCHANT_CODE)}`,
        { headers }
      );
      results.current_callback = await safeJson(getRes);

      const accRes = await fetch(
        `${OM_BASE_URL}/api/eWallet/v1/account?msisdn=${encodeURIComponent(OM_RETAILER_MSISDN)}&type=retailer`,
        { headers }
      );
      results.retailer_account = await safeJson(accRes);
    }

    // ── BALANCE : solde du compte LASSI ──────────────────────────────────────
    // ?action=balance
    if (action === 'balance') {
      const accRes = await fetch(
        `${OM_BASE_URL}/api/eWallet/v1/account?msisdn=${encodeURIComponent(OM_RETAILER_MSISDN)}&type=retailer`,
        { headers }
      );
      const acc = await safeJson(accRes) as Record<string, unknown>;
      results.msisdn   = OM_RETAILER_MSISDN;
      results.balance  = acc.balance;
      results.name     = `${acc.firstName ?? ''} ${acc.lastName ?? ''}`.trim();
      results.grade    = acc.grade;
      results.barred   = acc.barred;
      results.suspended = acc.suspended;
    }

    // ── TRANSACTIONS : historique LASSI ──────────────────────────────────────
    // ?action=transactions[&type=CASHIN|MERCHANT_PAYMENT][&size=20]
    if (action === 'transactions') {
      const type = url.searchParams.get('type') ?? '';          // CASHIN | MERCHANT_PAYMENT
      const size = url.searchParams.get('size') ?? '20';
      const from = url.searchParams.get('from') ?? '';          // ISO date ex: 2026-07-01T00:00:00Z
      let txUrl  = `${OM_BASE_URL}/api/eWallet/v1/transactions?size=${size}`;
      if (type) txUrl += `&type=${encodeURIComponent(type)}`;
      if (from) txUrl += `&fromDateTime=${encodeURIComponent(from)}`;

      const txRes  = await fetch(txUrl, { headers });
      const txData = await safeJson(txRes);
      results.transactions = txData;
      results.query = { type: type || 'all', size, from: from || 'all' };
    }

    // ── REGISTER WEBHOOK ─────────────────────────────────────────────────────
    if (action === 'register') {
      const postRes = await fetch(
        `${OM_BASE_URL}/api/notification/v1/merchantcallback`,
        {
          method: 'POST', headers,
          body: JSON.stringify({
            callbackUrl: CALLBACK_URL,
            code:        OM_MERCHANT_CODE,
            name:        'LASSI',
          }),
        }
      );
      results.register_status = postRes.status;
      results.register_result = await safeJson(postRes);
      results.register_ok     = postRes.status === 200 || postRes.status === 201;

      // Relire pour confirmer
      const getRes = await fetch(
        `${OM_BASE_URL}/api/notification/v1/merchantcallback?code=${encodeURIComponent(OM_MERCHANT_CODE)}`,
        { headers }
      );
      results.callback_after_register = await safeJson(getRes);
    }

    // ── ENCRYPT PIN (chiffre un PIN avec la clé RSA prod) ───────────────────
    // ?action=encrypt&pin=VOTRE_PIN
    if (action === 'encrypt') {
      const pin = url.searchParams.get('pin') ?? '';
      if (!pin) {
        results.error = 'Paramètre ?pin= manquant';
      } else if (!rsaKey) {
        results.error = 'Clé RSA prod non récupérée';
      } else {
        results.encrypted_pin = encryptPin(pin, rsaKey);
        results.key_id        = rsaData.keyId;
        results.note          = 'Utiliser cette valeur pour OM_RETAILER_PIN_ENCRYPTED dans Supabase';
      }
    }

    // ── CHANGE PIN + ENCRYPT NOUVEAU PIN ─────────────────────────────────────
    // ?action=change_pin&old_pin=0000&new_pin=VOTRE_NOUVEAU_PIN
    if (action === 'change_pin') {
      const oldPin = url.searchParams.get('old_pin') ?? '';
      const newPin = url.searchParams.get('new_pin') ?? '';
      if (!oldPin || !newPin) {
        results.error = 'Paramètres ?old_pin= et ?new_pin= manquants';
      } else if (!rsaKey) {
        results.error = 'Clé RSA prod non récupérée';
      } else {
        const encOld = encryptPin(oldPin, rsaKey);
        const encNew = encryptPin(newPin, rsaKey);

        const changeRes = await fetch(
          `${OM_BASE_URL}/api/eWallet/v1/account?msisdn=${encodeURIComponent(OM_RETAILER_MSISDN)}&type=retailer`,
          {
            method: 'PATCH', headers,
            body: JSON.stringify({ encryptedPinCode: encOld, encryptedNewPinCode: encNew }),
          }
        );
        results.change_pin_status = changeRes.status;
        results.change_pin_result = await safeJson(changeRes);
        results.change_pin_ok     = changeRes.status === 200 || changeRes.status === 204;

        if (results.change_pin_ok) {
          // Chiffrer le nouveau PIN → valeur à mettre dans Supabase
          results.new_encrypted_pin = encNew;
          results.note = 'PIN changé avec succès. Mettre new_encrypted_pin dans OM_RETAILER_PIN_ENCRYPTED (Supabase secrets).';
        }
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
