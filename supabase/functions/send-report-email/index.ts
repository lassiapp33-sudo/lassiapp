/**
 * Edge Function — send-report-email
 * Envoie un email de signalement à lassiapp33@gmail.com via Gmail SMTP.
 *
 * Variables d'environnement requises (supabase secrets set) :
 *   GMAIL_USER         = lassiapp33@gmail.com
 *   GMAIL_APP_PASSWORD = <mot de passe d'application Gmail (2FA requis)>
 *
 * Déployer : supabase functions deploy send-report-email
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient }   from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GMAIL_USER   = Deno.env.get('GMAIL_USER')                ?? '';
const GMAIL_PASS   = Deno.env.get('GMAIL_APP_PASSWORD')        ?? '';
const TO           = 'lassiapp33@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function fail(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function buildHtml(p: {
  typeLabel:    string;
  profil:       string;
  description:  string;
  userName:     string;
  userPhone:    string;
  orderId:      string | null;
  shopId:       string | null;
  screenshotUrl: string | null;
  timestamp:    string;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;color:#666;white-space:nowrap;vertical-align:top">${label}</td>
         <td style="padding:8px 12px;font-weight:500">${esc(value)}</td></tr>`;

  const optional = (label: string, value: string | null) =>
    value ? row(label, value) : '';

  const photoBlock = p.screenshotUrl
    ? `<div style="margin-top:20px">
         <a href="${p.screenshotUrl}"
            style="display:inline-block;background:#FDCF34;color:#14152A;
                   padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
           📎 Voir la capture d'écran
         </a>
       </div>`
    : '<p style="color:#999;font-style:italic;margin-top:12px">Aucune capture jointe.</p>';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

    <!-- En-tête -->
    <div style="background:#14152A;padding:24px 28px">
      <div style="font-size:22px;font-weight:700;color:#FDCF34;letter-spacing:-0.3px">🚨 Nouveau signalement</div>
      <div style="color:#9A9BB0;font-size:13px;margin-top:4px">LASSİ App — reçu le ${esc(p.timestamp)}</div>
    </div>

    <!-- Tableau récapitulatif -->
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden">
        ${row('Type',          p.typeLabel)}
        ${row('Profil',        p.profil === 'prestataire' ? 'Prestataire' : 'Client')}
        ${row('Utilisateur',   p.userName || '—')}
        ${row('Téléphone',     p.userPhone || '—')}
        ${optional('Commande', p.orderId)}
        ${optional('Commerce', p.shopId)}
      </table>

      <!-- Description -->
      <div style="margin-top:20px">
        <div style="color:#14152A;font-weight:600;margin-bottom:8px">Description</div>
        <div style="background:#f9f9f9;border-left:3px solid #FDCF34;padding:14px 16px;
                    border-radius:0 6px 6px 0;color:#333;line-height:1.6;font-size:14px">
          ${esc(p.description)}
        </div>
      </div>

      <!-- Photo -->
      ${photoBlock}
    </div>

    <!-- Pied de page -->
    <div style="background:#f4f4f4;padding:14px 28px;font-size:11px;color:#aaa;text-align:center">
      LASSİ App · Dakar, Sénégal · Ce message est automatique
    </div>
  </div>
</body></html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // 1. Vérification JWT
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const sb    = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return fail('Non autorisé', 401);

    // 2. Payload
    const body = await req.json() as {
      typeLabel:     string;
      profil:        string;
      description:   string;
      userName:      string;
      userPhone:     string;
      orderId?:      string | null;
      shopId?:       string | null;
      screenshotUrl?: string | null;
      timestamp:     string;
    };

    const { typeLabel, profil, description, userName, userPhone,
            orderId = null, shopId = null, screenshotUrl = null, timestamp } = body;

    if (!typeLabel || !description || !timestamp) return fail('Paramètres manquants', 400);

    // 3. Envoi email via Gmail SMTP
    if (!GMAIL_USER || !GMAIL_PASS) {
      console.warn('[send-report-email] GMAIL_USER ou GMAIL_APP_PASSWORD non configuré.');
      return fail('Configuration email manquante.', 503);
    }

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port:     465,
        tls:      true,
        auth:     { username: GMAIL_USER, password: GMAIL_PASS },
      },
    });

    await client.send({
      from:    `LASSI App <${GMAIL_USER}>`,
      to:      TO,
      subject: `[LASSİ] Signalement : ${typeLabel}`,
      html:    buildHtml({ typeLabel, profil, description, userName, userPhone,
                           orderId, shopId, screenshotUrl, timestamp }),
    });

    await client.close();

    return ok({ sent: true });

  } catch (e) {
    console.error('[send-report-email]', e);
    return fail((e as Error).message ?? 'Erreur interne');
  }
});
