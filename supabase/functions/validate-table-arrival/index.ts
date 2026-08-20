// ============================================================
// EDGE FUNCTION : validate-table-arrival
// Permet au gérant de valider l'arrivée du client en scannant son QR code.
// Appelle le RPC valider_arrivee_reservation (SECURITY DEFINER).
// Rappelle au gérant de déduire l'acompte (3 000 FCFA) de la note finale.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isSafeString } from '../_shared/validation.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  try {
    // ① Auth
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return json({ error: 'Non autorisé' }, 401)

    // ② Body
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Body invalide' }, 400) }

    const { qrCode } = body
    if (!isSafeString(qrCode, { maxLen: 30, minLen: 4 })) {
      return json({ error: 'QR code invalide' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ③ Appel RPC
    const { data, error } = await admin.rpc('valider_arrivee_reservation', {
      p_qr_code:        (qrCode as string).toUpperCase().trim(),
      p_gerant_user_id: user.id,
    })

    if (error) throw new Error(error.message)

    const result = data as {
      success: boolean
      error?: string
      statut?: string
      nb_personnes?: number
      acompte_montant?: number
      motif?: string
      options?: string[]
    }

    if (!result.success) {
      return json({ success: false, error: result.error ?? 'Validation échouée' }, 422)
    }

    // ④ Retourner les infos pour affichage gérant (dont rappel acompte à déduire)
    return json({
      success: true,
      nbPersonnes:    result.nb_personnes,
      acompteADeduire: result.acompte_montant,  // rappel : déduire de la note finale
      motif:          result.motif,
      options:        result.options ?? [],
      message:        `Bienvenue. Pensez à déduire ${result.acompte_montant ?? 3000} FCFA de la note finale.`,
    })

  } catch (err) {
    console.error('[validate-table-arrival]', err)
    return json({ error: 'Erreur interne' }, 500)
  }
})
