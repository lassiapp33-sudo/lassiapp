import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errResp(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function normaliserTel(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('221') ? d.slice(3) : d
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Vérifier que l'appelant est admin ──────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return errResp(401, 'Non authentifié')

    const { data: profCheck } = await anonClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profCheck?.is_admin) return errResp(403, 'Accès réservé aux administrateurs')

    // ── 2. Paramètres ─────────────────────────────────────────────────────
    const {
      telephone,
      motDePasse,
      nomAffiche,
      categorie,
      gabarit = 'palais',
      initiale,
      baseline,
      latitude  = null,
      longitude = null,
    } = await req.json()

    if (!telephone || !motDePasse || !nomAffiche || !categorie || !initiale) {
      return errResp(400, 'Champs obligatoires : telephone, motDePasse, nomAffiche, categorie, initiale')
    }
    if (String(motDePasse).length < 8) {
      return errResp(400, 'Le mot de passe doit contenir au moins 8 caractères')
    }

    const tel   = normaliserTel(String(telephone))
    const email = `221${tel}@lassi.app`

    // ── 3. Service role ───────────────────────────────────────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 4. Créer ou récupérer le compte auth (idempotent) ─────────────────
    // L'email est UNIQUE dans auth.users → source de vérité fiable
    let userId: string

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: String(motDePasse),
      email_confirm: true,
    })

    if (authData?.user) {
      // Nouveau compte créé
      userId = authData.user.id
    } else if (authErr) {
      const alreadyExists =
        authErr.message.includes('already been registered') ||
        authErr.message.includes('already exists')

      if (!alreadyExists) return errResp(400, `Auth : ${authErr.message}`)

      // Compte existant (tentative partielle précédente) → retrouver l'ID via email unique
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) return errResp(500, `Recherche compte : ${listErr.message}`)

      const existing = listData.users.find((u: { email?: string }) => u.email === email)
      if (!existing) return errResp(400, `Auth : ${authErr.message}`)

      // Vérifier qu'il n'a pas déjà un profil VIP complet
      const { data: vpRows } = await admin
        .from('vip_profils')
        .select('id')
        .eq('gerant_user_id', existing.id)
        .limit(1)
      if (vpRows && vpRows.length > 0) return errResp(409, `Le numéro ${tel} est deja lie a un profil 5 Etoiles.`)

      userId = existing.id
    } else {
      return errResp(500, 'Réponse inattendue de Auth')
    }

    // ── 5. Profil prestataire (upsert = safe si trigger déjà passé) ───────
    const { error: profErr } = await admin.from('profiles').upsert({
      id:         userId,
      name:       String(nomAffiche),
      phone:      tel,
      auth_email: email,
      role:       'merchant',
      is_admin:   false,
    }, { onConflict: 'id' })
    if (profErr) return errResp(400, `Profil : ${profErr.message}`)

    // ── 6. Boutique VIP (réutiliser si déjà créée lors d'une tentative précédente) ──
    let shopId: string

    const { data: shopRows } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', userId)
      .eq('is_etoiles', true)
      .limit(1)

    if (shopRows && shopRows.length > 0) {
      shopId = shopRows[0].id
    } else {
      const { data: shopData, error: shopErr } = await admin
        .from('shops')
        .insert({
          merchant_id:        userId,
          name:               String(nomAffiche),
          subtitle:           '',
          description:        null,
          category:           String(categorie),
          subcategories:      [],
          shop_type:          'products',
          address_text:       null,
          latitude:           latitude != null ? Number(latitude) : null,
          longitude:          longitude != null ? Number(longitude) : null,
          zone:               '',
          is_open:            true,
          is_manually_closed: false,
          opening_hours:      null,
          is_vip:             true,
          is_etoiles:         true,
          rating:             0,
          reviews_count:      0,
        })
        .select('id')
        .single()
      if (shopErr) return errResp(400, `Boutique : ${shopErr.message}`)
      shopId = shopData.id
    }

    // ── 7. Profil VIP (upsert sur shop_id unique) ─────────────────────────
    const { error: vpErr } = await admin.from('vip_profils').upsert({
      shop_id:          shopId,
      categorie:        String(categorie),
      gabarit:          String(gabarit),
      nom_affiche:      String(nomAffiche),
      baseline:         baseline ? String(baseline) : null,
      initiale:         String(initiale).toUpperCase().charAt(0),
      telephone_gerant: tel,
      actif:            true,
      gerant_user_id:   userId,
    }, { onConflict: 'shop_id' })
    if (vpErr) return errResp(400, `Profil VIP : ${vpErr.message}`)

    return new Response(
      JSON.stringify({ success: true, shopId, userId }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return errResp(500, msg)
  }
})
