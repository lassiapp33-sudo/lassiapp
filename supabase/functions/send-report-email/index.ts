import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isSafeString, escapeHtml } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

const ADMIN_EMAIL = 'lassiapp33@gmail.com'

// Champs affichés sur une seule ligne (objet/sujet d'email) : on interdit les
// retours à la ligne pour empêcher toute injection d'en-têtes.
const SINGLE_LINE = /^[^\r\n]*$/

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Authentification : seul un utilisateur connecté peut déclencher l'envoi ──
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Non autorisé' }, 401)

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('[send-report-email] RESEND_API_KEY manquant')
      return json({ error: 'Service email non configuré' }, 500)
    }

    const {
      typeLabel,
      profil,
      description,
      userName,
      userPhone,
      orderId,
      shopId,
      screenshotUrl,
      timestamp,
    } = await req.json()

    // ── Section 4 : validation stricte des entrées ────────────────────────────
    if (!isSafeString(typeLabel, { maxLen: 100, minLen: 1, pattern: SINGLE_LINE })) {
      return json({ error: 'typeLabel invalide' }, 400)
    }
    if (profil !== 'client' && profil !== 'prestataire') {
      return json({ error: 'profil invalide' }, 400)
    }
    if (!isSafeString(description, { maxLen: 2000, minLen: 1 })) {
      return json({ error: 'description invalide (1-2000 caractères)' }, 400)
    }
    if (!isSafeString(userName, { maxLen: 200, minLen: 1, pattern: SINGLE_LINE })) {
      return json({ error: 'userName invalide' }, 400)
    }
    if (!isSafeString(userPhone, { maxLen: 30, minLen: 1, pattern: SINGLE_LINE })) {
      return json({ error: 'userPhone invalide' }, 400)
    }
    if (orderId !== undefined && orderId !== null && !isUUID(orderId)) {
      return json({ error: 'orderId invalide' }, 400)
    }
    if (shopId !== undefined && shopId !== null && !isUUID(shopId)) {
      return json({ error: 'shopId invalide' }, 400)
    }
    if (
      screenshotUrl !== undefined && screenshotUrl !== null &&
      !isSafeString(screenshotUrl, { maxLen: 2000, pattern: /^https:\/\/.+/ })
    ) {
      return json({ error: 'screenshotUrl invalide' }, 400)
    }
    if (!isSafeString(timestamp, { maxLen: 100, minLen: 1, pattern: SINGLE_LINE })) {
      return json({ error: 'timestamp invalide' }, 400)
    }

    const profilLabel = profil === 'prestataire' ? 'Prestataire' : 'Client'

    // ── Échappement HTML de toutes les valeurs interpolées ─────────────────────
    const safeTypeLabel  = escapeHtml(typeLabel)
    const safeUserName   = escapeHtml(userName)
    const safeUserPhone  = escapeHtml(userPhone)
    const safeOrderId    = orderId ? escapeHtml(orderId) : null
    const safeShopId     = shopId ? escapeHtml(shopId) : null
    const safeTimestamp  = escapeHtml(timestamp)
    const safeDescription = escapeHtml(description).replace(/\n/g, '<br>')
    const safeScreenshotUrl = screenshotUrl ? escapeHtml(screenshotUrl) : null

    const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
  <div style="background:#14152A;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#FDCF34;margin:0;font-size:20px;">🚨 Nouveau signalement LASSI</h1>
  </div>

  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;">

    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;width:140px;">Type</td>
        <td style="padding:10px 14px;color:#111;">${safeTypeLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Profil</td>
        <td style="padding:10px 14px;color:#111;">${profilLabel}</td>
      </tr>
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Utilisateur</td>
        <td style="padding:10px 14px;color:#111;">${safeUserName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Téléphone</td>
        <td style="padding:10px 14px;color:#111;">${safeUserPhone}</td>
      </tr>
      ${safeOrderId ? `
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Commande ID</td>
        <td style="padding:10px 14px;color:#111;font-size:12px;">${safeOrderId}</td>
      </tr>` : ''}
      ${safeShopId ? `
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Commerce ID</td>
        <td style="padding:10px 14px;color:#111;font-size:12px;">${safeShopId}</td>
      </tr>` : ''}
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Date</td>
        <td style="padding:10px 14px;color:#111;">${safeTimestamp}</td>
      </tr>
    </table>

    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#555;margin-bottom:8px;">Description :</p>
      <div style="background:#f9f9f9;border-left:4px solid #FDCF34;padding:14px 16px;border-radius:4px;color:#222;line-height:1.6;">
        ${safeDescription}
      </div>
    </div>

    ${safeScreenshotUrl ? `
    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#555;margin-bottom:8px;">Capture d'écran :</p>
      <a href="${safeScreenshotUrl}" style="display:inline-block;background:#14152A;color:#FDCF34;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;">
        Voir la capture (lien valide 24h)
      </a>
    </div>` : ''}

  </div>

  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">
    LASSI — Signalement automatique · ${safeTimestamp}
  </p>
</div>
`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'LASSI Signalements <onboarding@resend.dev>',
        to:      [ADMIN_EMAIL],
        subject: `[LASSI] Signalement ${typeLabel} — ${profilLabel} ${userName}`,
        html:    htmlBody,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[send-report-email] Resend error:', err)
      throw new Error(`Resend: ${err}`)
    }

    return json({ ok: true })
  } catch (err: any) {
    console.error('[send-report-email] Erreur:', err.message)
    return json({ error: err.message ?? 'Erreur interne' }, 500)
  }
})
