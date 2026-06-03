const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'lassiapp33@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('[send-report-email] RESEND_API_KEY manquant')
      return new Response(JSON.stringify({ error: 'Service email non configuré' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
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

    const profilLabel = profil === 'merchant' ? 'Prestataire' : 'Client'

    const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
  <div style="background:#14152A;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#FDCF34;margin:0;font-size:20px;">🚨 Nouveau signalement LASSI</h1>
  </div>

  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;">

    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;width:140px;">Type</td>
        <td style="padding:10px 14px;color:#111;">${typeLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Profil</td>
        <td style="padding:10px 14px;color:#111;">${profilLabel}</td>
      </tr>
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Utilisateur</td>
        <td style="padding:10px 14px;color:#111;">${userName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Téléphone</td>
        <td style="padding:10px 14px;color:#111;">${userPhone}</td>
      </tr>
      ${orderId ? `
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Commande ID</td>
        <td style="padding:10px 14px;color:#111;font-size:12px;">${orderId}</td>
      </tr>` : ''}
      ${shopId ? `
      <tr>
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Commerce ID</td>
        <td style="padding:10px 14px;color:#111;font-size:12px;">${shopId}</td>
      </tr>` : ''}
      <tr style="background:#f5f5f5;">
        <td style="padding:10px 14px;font-weight:bold;color:#555;">Date</td>
        <td style="padding:10px 14px;color:#111;">${timestamp}</td>
      </tr>
    </table>

    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#555;margin-bottom:8px;">Description :</p>
      <div style="background:#f9f9f9;border-left:4px solid #FDCF34;padding:14px 16px;border-radius:4px;color:#222;line-height:1.6;">
        ${description.replace(/\n/g, '<br>')}
      </div>
    </div>

    ${screenshotUrl ? `
    <div style="margin-top:20px;">
      <p style="font-weight:bold;color:#555;margin-bottom:8px;">Capture d'écran :</p>
      <a href="${screenshotUrl}" style="display:inline-block;background:#14152A;color:#FDCF34;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;">
        Voir la capture (lien valide 24h)
      </a>
    </div>` : ''}

  </div>

  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">
    LASSI — Signalement automatique · ${timestamp}
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-report-email] Erreur:', err.message)
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
