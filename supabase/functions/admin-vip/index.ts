// ============================================================
// admin-vip — Gestion des comptes 5 Étoiles
//
// Actions :
//   creer      — crée le compte gérant + profil VIP (atomique, rollback si erreur)
//   lister     — liste tous les profils VIP (actifs + suspendus)
//   suspendre  — désactive un profil (actif = false)
//   reactiver  — réactive un profil (actif = true)
//   supprimer  — supprime profil + compte auth (irréversible)
//
// Accès : administrateur LASSI uniquement (is_admin = true dans profiles).
// Auth  : JWT utilisateur → vérification is_admin côté serveur (pas app_metadata).
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders }   from '../_shared/cors.ts'
import { logAuditEvent } from '../_shared/audit.ts'
import {
  isUUID,
  isSafeString,
  isSenegalPhoneLocal,
} from '../_shared/validation.ts'

// Catégories valides (doit rester synchronisé avec l'enum SQL vip_categorie)
const VIP_CATEGORIES = new Set([
  'restauration',
  'musculation_fitness',
  'boulangerie_patisserie',
  'beaute_tressage',
  'coiffure',
])

// Format de mot de passe temporaire : min 8 caractères
const MIN_MDP_LEN = 8

// Email technique VIP — domaine séparé de @lassi.app pour éviter toute collision
// avec les comptes marchands/clients déjà enregistrés.
// Entrée : téléphone local "781234567" → "781234567@vip.lassi.app"
function emailVip(telephone: string): string {
  return `${telephone}@vip.lassi.app`
}

// Normalise un numéro vers le format local sénégalais (9 chiffres).
// Accepte : "+221781234567", "221781234567", "781234567", "78 123 45 67"
function normaliserTelephone(tel: unknown): string | null {
  if (typeof tel !== 'string') return null
  const digits = tel.replace(/[^0-9]/g, '')
  if (digits.startsWith('221') && digits.length === 12) {
    return digits.slice(3)
  }
  if (digits.length === 9) return digits
  return null
}

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
    // ── 1. Authentification de l'appelant ────────────────────────────────────
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ erreur: 'Non autorisé' }, 401)

    // Client service_role pour les opérations sensibles
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Vérification is_admin côté serveur (source de vérité : profiles)
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return json({ erreur: 'Réservé à l\'administration LASSI' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { action } = body

    // ── 2. CRÉER ─────────────────────────────────────────────────────────────
    if (action === 'creer') {
      const { shop_id, telephone, mot_de_passe, categorie,
              nom_affiche, initiale, gabarit, baseline } = body

      // Validation des entrées
      if (!isUUID(shop_id))
        return json({ erreur: 'shop_id invalide' }, 400)

      const tel = normaliserTelephone(telephone)
      if (!tel || !isSenegalPhoneLocal(tel))
        return json({ erreur: 'Numéro de téléphone invalide (format : 7XXXXXXXX)' }, 400)

      if (!isSafeString(mot_de_passe, { minLen: MIN_MDP_LEN, maxLen: 72 }))
        return json({ erreur: `Mot de passe trop court (${MIN_MDP_LEN} caractères minimum)` }, 400)

      if (!VIP_CATEGORIES.has(categorie))
        return json({ erreur: 'Catégorie VIP invalide' }, 400)

      if (!isSafeString(nom_affiche, { minLen: 2, maxLen: 80 }))
        return json({ erreur: 'Nom affiché invalide (2–80 caractères)' }, 400)

      // Vérifier que le shop existe
      const { data: shop, error: shopErr } = await admin
        .from('shops').select('id, name').eq('id', shop_id).single()
      if (shopErr || !shop)
        return json({ erreur: 'Établissement introuvable' }, 404)

      // Vérifier qu'il n'a pas déjà un profil VIP actif
      const { data: existing } = await admin
        .from('vip_profils').select('id').eq('shop_id', shop_id).maybeSingle()
      if (existing)
        return json({ erreur: 'Cet établissement a déjà un profil 5 Étoiles' }, 409)

      // Créer le compte gérant dans Supabase Auth
      const { data: compte, error: authErr } = await admin.auth.admin.createUser({
        email: emailVip(tel),
        password: mot_de_passe,
        email_confirm: true,
        phone: `+221${tel}`,
        app_metadata: { role: 'vip_gerant' },
        user_metadata: {
          name: nom_affiche,
          role: 'vip_gerant',
          phone: tel,
          doit_changer_mdp: true,
        },
      })
      if (authErr || !compte.user)
        return json({ erreur: authErr?.message ?? 'Erreur création compte' }, 400)

      // Créer le profil VIP (rollback compte si erreur)
      const initialeFinale = typeof initiale === 'string' && initiale.length === 1
        ? initiale.toUpperCase()
        : nom_affiche[0].toUpperCase()

      const gabaritFinal = gabarit === 'maison' ? 'maison' : 'palais'

      const { data: profil, error: profilErr } = await admin
        .from('vip_profils')
        .insert({
          shop_id,
          gerant_user_id: compte.user.id,
          categorie,
          initiale: initialeFinale,
          nom_affiche,
          baseline: isSafeString(baseline, { maxLen: 120 }) ? baseline : null,
          gabarit: gabaritFinal,
          telephone_gerant: tel,
          cree_par: user.id,
        })
        .select()
        .single()

      if (profilErr) {
        // Rollback : pas de compte gérant orphelin
        await admin.auth.admin.deleteUser(compte.user.id)
        return json({ erreur: profilErr.message }, 400)
      }

      await logAuditEvent(admin, {
        action: 'vip_creer',
        targetTable: 'vip_profils',
        targetId: profil.id,
        after: { shop_id, nom_affiche, categorie },
        metadata: { admin_name: profile.name },
      })

      return json({ profil, gerant_email: emailVip(tel) })
    }

    // ── 3. LISTER ────────────────────────────────────────────────────────────
    if (action === 'lister') {
      const { data, error } = await admin
        .from('vip_profils')
        .select(`
          id, shop_id, categorie, nom_affiche, initiale, gabarit,
          telephone_gerant, actif, created_at,
          shops ( name, category )
        `)
        .order('created_at', { ascending: false })

      if (error) return json({ erreur: error.message }, 500)
      return json({ liste: data ?? [] })
    }

    // ── 4. SUSPENDRE ─────────────────────────────────────────────────────────
    if (action === 'suspendre') {
      const { vip_profil_id } = body
      if (!isUUID(vip_profil_id)) return json({ erreur: 'vip_profil_id invalide' }, 400)

      const { error } = await admin
        .from('vip_profils')
        .update({ actif: false })
        .eq('id', vip_profil_id)

      if (error) return json({ erreur: error.message }, 500)

      await logAuditEvent(admin, {
        action: 'vip_suspendre',
        targetTable: 'vip_profils',
        targetId: vip_profil_id,
        metadata: { admin_name: profile.name },
      })

      return json({ ok: true })
    }

    // ── 5. RÉACTIVER ─────────────────────────────────────────────────────────
    if (action === 'reactiver') {
      const { vip_profil_id } = body
      if (!isUUID(vip_profil_id)) return json({ erreur: 'vip_profil_id invalide' }, 400)

      const { error } = await admin
        .from('vip_profils')
        .update({ actif: true })
        .eq('id', vip_profil_id)

      if (error) return json({ erreur: error.message }, 500)

      await logAuditEvent(admin, {
        action: 'vip_reactiver',
        targetTable: 'vip_profils',
        targetId: vip_profil_id,
        metadata: { admin_name: profile.name },
      })

      return json({ ok: true })
    }

    // ── 6. SUPPRIMER ─────────────────────────────────────────────────────────
    if (action === 'supprimer') {
      const { vip_profil_id } = body
      if (!isUUID(vip_profil_id)) return json({ erreur: 'vip_profil_id invalide' }, 400)

      // Récupérer gerant_user_id avant suppression (pour rollback propre)
      const { data: p, error: fetchErr } = await admin
        .from('vip_profils')
        .select('gerant_user_id, nom_affiche')
        .eq('id', vip_profil_id)
        .single()

      if (fetchErr || !p) return json({ erreur: 'Profil introuvable' }, 404)

      // Supprimer le profil (cascade supprime prestations + horaires)
      const { error: delErr } = await admin
        .from('vip_profils')
        .delete()
        .eq('id', vip_profil_id)

      if (delErr) return json({ erreur: delErr.message }, 500)

      // Supprimer le compte gérant Auth
      if (p.gerant_user_id) {
        await admin.auth.admin.deleteUser(p.gerant_user_id)
      }

      await logAuditEvent(admin, {
        action: 'vip_supprimer',
        targetTable: 'vip_profils',
        targetId: vip_profil_id,
        metadata: { admin_name: profile.name, nom_affiche: p.nom_affiche },
      })

      return json({ ok: true })
    }

    return json({ erreur: 'Action inconnue' }, 400)

  } catch (err) {
    console.error('[admin-vip]', err)
    return new Response(JSON.stringify({ erreur: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
