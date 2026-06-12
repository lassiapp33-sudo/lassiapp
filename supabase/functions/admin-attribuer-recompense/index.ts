/**
 * admin-attribuer-recompense — Edge Function sécurisée pour l'attribution
 * manuelle de récompenses de classement (badge, certificat, priorité
 * recherche, crédit Lassi, carrousel "Offre di Quartier", Top VIP) à un
 * prestataire ou un client.
 * Seul un compte avec is_admin = true peut appeler cette fonction.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isUUID, isBoolean, isISODateString, isSafeString, isNonNegativeInt } from '../_shared/validation.ts'
import { logAuditEvent } from '../_shared/audit.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Créer un client avec le JWT de l'utilisateur
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    // Vérifier l'identité
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Vérifier is_admin côté serveur
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé — droits admin requis' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    // ── Révocation d'une récompense manuelle ──────────────────────────────
    if (action === 'revoquer') {
      const { recompenseId } = body

      if (!isUUID(recompenseId)) {
        return new Response(JSON.stringify({ error: 'recompenseId invalide' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const { data: before } = await admin
        .from('recompenses_attribuees')
        .select('*')
        .eq('id', recompenseId)
        .eq('type_classement', 'manuel')
        .single()

      if (!before) {
        return new Response(JSON.stringify({ error: 'Récompense manuelle introuvable' }), {
          status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const { error: updateErr } = await admin
        .from('recompenses_attribuees')
        .update({ est_actif: false })
        .eq('id', recompenseId)

      if (updateErr) throw updateErr

      await admin.from('admin_actions_log').insert({
        admin_id: user.id,
        action: 'revoquer_recompense',
        target_user_id: before.prestataire_id ?? before.client_id,
        details: { recompense_id: recompenseId, admin_name: profile.name },
      })

      await logAuditEvent(admin, {
        action: 'revoquer_recompense',
        targetTable: 'recompenses_attribuees',
        targetId: recompenseId,
        before,
        after: { ...before, est_actif: false },
        actorId: user.id,
        actorRole: 'admin',
      })

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── Attribution d'une récompense manuelle ──────────────────────────────
    if (action !== 'attribuer') {
      return new Response(JSON.stringify({ error: 'action invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const {
      prestataireId,
      clientId,
      badge,
      certificat,
      prioriteRecherche,
      creditLassi,
      carrouselProduits,
      topVip,
      validUntil,
      note,
    } = body

    // Exactement une cible : prestataire OU client
    const hasPresta = prestataireId !== undefined && prestataireId !== null
    const hasClient = clientId !== undefined && clientId !== null
    if (hasPresta === hasClient) {
      return new Response(JSON.stringify({ error: 'Choisir soit un prestataire, soit un client' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (hasPresta && !isUUID(prestataireId)) {
      return new Response(JSON.stringify({ error: 'prestataireId invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (hasClient && !isUUID(clientId)) {
      return new Response(JSON.stringify({ error: 'clientId invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (badge !== undefined && badge !== null && !isSafeString(badge, { maxLen: 100 })) {
      return new Response(JSON.stringify({ error: 'badge invalide (100 caractères max)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (certificat !== undefined && !isBoolean(certificat)) {
      return new Response(JSON.stringify({ error: 'certificat doit être un booléen' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (prioriteRecherche !== undefined && !isBoolean(prioriteRecherche)) {
      return new Response(JSON.stringify({ error: 'prioriteRecherche doit être un booléen' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (topVip !== undefined && !isBoolean(topVip)) {
      return new Response(JSON.stringify({ error: 'topVip doit être un booléen' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (creditLassi !== undefined && !isNonNegativeInt(creditLassi, 100_000)) {
      return new Response(JSON.stringify({ error: 'creditLassi invalide (0 à 100 000)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (carrouselProduits !== undefined && !isNonNegativeInt(carrouselProduits, 5)) {
      return new Response(JSON.stringify({ error: 'carrouselProduits invalide (0 à 5)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (validUntil !== undefined && validUntil !== null && !isISODateString(validUntil)) {
      return new Response(JSON.stringify({ error: 'validUntil invalide' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    if (note !== undefined && note !== null && !isSafeString(note, { maxLen: 500 })) {
      return new Response(JSON.stringify({ error: 'note trop longue (500 caractères max)' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Vérifier que le profil cible existe
    const targetId = hasPresta ? prestataireId : clientId
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', targetId)
      .single()

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'Profil introuvable' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const row = {
      prestataire_id: hasPresta ? prestataireId : null,
      client_id: hasClient ? clientId : null,
      type_classement: 'manuel',
      periode,
      rang: 0,
      badge: badge ?? null,
      certificat: certificat ?? false,
      priorite_recherche: prioriteRecherche ?? false,
      credit_lassi: creditLassi ?? 0,
      carrousel_produits: carrouselProduits ?? 0,
      top_vip: topVip ?? false,
      valide_jusqu_a: validUntil ?? null,
      est_actif: true,
    }

    const { data: inserted, error: insertErr } = await admin
      .from('recompenses_attribuees')
      .insert(row)
      .select()
      .single()

    if (insertErr) throw insertErr

    await admin.from('admin_actions_log').insert({
      admin_id: user.id,
      action: 'attribuer_recompense',
      target_user_id: targetId,
      details: { ...row, note, admin_name: profile.name },
    })

    await logAuditEvent(admin, {
      action: 'attribuer_recompense',
      targetTable: 'recompenses_attribuees',
      targetId: inserted.id,
      before: null,
      after: row,
      actorId: user.id,
      actorRole: 'admin',
    })

    return new Response(JSON.stringify({ ok: true, recompense: inserted }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erreur interne' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
