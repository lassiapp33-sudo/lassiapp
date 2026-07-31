import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function err(status: number, message: string) {
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
    if (!user) return err(401, 'Non authentifié')

    const { data: profCheck } = await anonClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profCheck?.is_admin) return err(403, 'Accès réservé aux administrateurs')

    // ── 2. Paramètres ─────────────────────────────────────────────────────
    const {
      telephone,
      motDePasse,
      nomAffiche,
      categorie,
      gabarit = 'palais',
      initiale,
      baseline,
    } = await req.json()

    if (!telephone || !motDePasse || !nomAffiche || !categorie || !initiale) {
      return err(400, 'Champs obligatoires : telephone, motDePasse, nomAffiche, categorie, initiale')
    }
    if (String(motDePasse).length < 8) {
      return err(400, 'Le mot de passe doit contenir au moins 8 caractères')
    }

    const tel   = normaliserTel(String(telephone))
    const email = `221${tel}@lassi.app`

    // ── 3. Service role pour les opérations admin ─────────────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 4. Résoudre l'utilisateur (idempotent : reprise si création partielle) ──
    let userId: string

    // Chercher d'abord par téléphone dans profiles (même si le trigger a déjà créé le profil)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', tel)
      .maybeSingle()

    if (existingProfile) {
      // Compte déjà connu → vérifier qu'il n'a pas déjà un profil VIP complet
      const { data: vpExist } = await admin
        .from('vip_profils')
        .select('id')
        .eq('gerant_user_id', existingProfile.id)
        .maybeSingle()
      if (vpExist) return err(409, `Le numéro ${tel} est déjà lié à un profil 5 Étoiles.`)
      userId = existingProfile.id
    } else {
      // Créer le compte auth (première tentative propre)
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: String(motDePasse),
        email_confirm: true,
      })
      if (authErr) return err(400, `Auth : ${authErr.message}`)
      userId = authData.user!.id
    }

    // ── 5. Profil prestataire (upsert = safe si le trigger l'a déjà créé) ──
    const { error: profErr } = await admin.from('profiles').upsert({
      id:       userId,
      name:     String(nomAffiche),
      phone:    tel,
      role:     'merchant',
      is_admin: false,
    }, { onConflict: 'id' })
    if (profErr) return err(400, `Profil : ${profErr.message}`)

    // ── 6. Boutique VIP (idempotent : réutiliser si déjà créée) ──────────
    let shopId: string

    const { data: existingShop } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', userId)
      .eq('is_vip', true)
      .maybeSingle()

    if (existingShop) {
      shopId = existingShop.id
    } else {
      const { data: shopData, error: shopErr } = await admin
        .from('shops')
        .insert({
          merchant_id:         userId,
          name:                String(nomAffiche),
          subtitle:            '',
          description:         null,
          category:            String(categorie),
          subcategories:       [],
          shop_type:           'products',
          address_text:        null,
          latitude:            null,
          longitude:           null,
          zone:                '',
          is_open:             true,
          is_manually_closed:  false,
          opening_hours:       null,
          is_vip:              true,
          rating:              0,
          reviews_count:       0,
        })
        .select('id')
        .single()
      if (shopErr) return err(400, `Boutique : ${shopErr.message}`)
      shopId = shopData.id
    }

    // ── 7. Profil VIP (idempotent : upsert sur shop_id unique) ───────────
    const { error: vpErr } = await admin.from('vip_profils').upsert({
      shop_id:          shopId,
      categorie:        String(categorie),
      gabarit:          String(gabarit),
      nom_affiche:      String(nomAffiche),
      baseline:         baseline ? String(baseline) : null,
      initiale:         String(initiale).toUpperCase().charAt(0),
      telephone_gerant: tel,
      actif:            false,
      gerant_user_id:   userId,
    }, { onConflict: 'shop_id' })
    if (vpErr) return err(400, `Profil VIP : ${vpErr.message}`)

    return new Response(
      JSON.stringify({ success: true, shopId, userId }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return err(500, msg)
  }
})
