// ============================================================
// EDGE FUNCTION : attribuer-recompenses-mondial
// Appelée le 1er de chaque mois par GitHub Actions (00:10 UTC)
// APRÈS que pg_cron a calculé les classements finaux (00:05 UTC).
//
// Sécurité : X-Cron-Secret = CRON_SECRET (GitHub Actions)
//            OU JWT admin valide.
// Idempotence : vérifie avant d'insérer — safe à re-appeler.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendPushToUser } from '../_shared/push.ts'

// Miroir de src/config/rewards.ts — à synchroniser si le config change.
interface Palier {
  rangMin: number
  rangMax: number
  badge: string
  certificat: boolean
  prioriteRecherche: boolean
  creditLassi: number
  carrouselProduits: number
}

const PALIERS: Palier[] = [
  { rangMin: 1,  rangMax: 1,  badge: 'Champion National', certificat: true,  prioriteRecherche: true,  creditLassi: 8000, carrouselProduits: 5 },
  { rangMin: 2,  rangMax: 2,  badge: 'Vice-Champion',     certificat: true,  prioriteRecherche: true,  creditLassi: 5000, carrouselProduits: 4 },
  { rangMin: 3,  rangMax: 3,  badge: '3e National',       certificat: true,  prioriteRecherche: true,  creditLassi: 3000, carrouselProduits: 3 },
  { rangMin: 4,  rangMax: 4,  badge: 'Top 4 National',    certificat: true,  prioriteRecherche: true,  creditLassi: 2000, carrouselProduits: 2 },
  { rangMin: 5,  rangMax: 5,  badge: 'Top 5 National',    certificat: true,  prioriteRecherche: true,  creditLassi: 1500, carrouselProduits: 1 },
  { rangMin: 6,  rangMax: 10, badge: 'Top 10 National',   certificat: true,  prioriteRecherche: true,  creditLassi: 1000, carrouselProduits: 0 },
  { rangMin: 11, rangMax: 20, badge: 'Top 20 National',   certificat: true,  prioriteRecherche: false, creditLassi: 0,    carrouselProduits: 0 },
  { rangMin: 21, rangMax: 40, badge: 'Top 40 National',   certificat: false, prioriteRecherche: false, creditLassi: 0,    carrouselProduits: 0 },
]

function getPalier(rang: number): Palier | null {
  return PALIERS.find(p => rang >= p.rangMin && rang <= p.rangMax) ?? null
}

function previousMonthPeriode(): string {
  const now = new Date()
  const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const m = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()
  return `${y}-${String(m).padStart(2, '0')}`
}

// Dernier instant du mois suivant la période — pour les perks à durée limitée.
function valideJusquaActif(periode: string): string {
  const [y, m] = periode.split('-').map(Number)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  return new Date(Date.UTC(nextY, nextM, 0, 23, 59, 59)).toISOString()
}

function labelMois(periode: string): string {
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const [y, m] = periode.split('-').map(Number)
  return `${MOIS[m - 1] ?? m} ${y}`
}

interface Winner {
  rang: number
  points: number
  prestataire_id: string
}

interface RecompenseRow {
  prestataire_id: string
  client_id: null
  type_classement: string
  periode: string
  rang: number
  badge: string
  certificat: boolean
  priorite_recherche: boolean
  credit_lassi: number
  carrousel_produits: number
  top_vip: boolean
  valide_jusqu_a: string | null
  est_actif: boolean
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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!
  const CRON_SECRET      = Deno.env.get('CRON_SECRET') ?? ''

  const cronHeader = req.headers.get('X-Cron-Secret') ?? ''
  const auth       = req.headers.get('Authorization') ?? ''

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // ── Authentification : X-Cron-Secret (GitHub Actions) ou JWT admin ───────
  const isCron = CRON_SECRET !== '' && cronHeader === CRON_SECRET

  if (!isCron) {
    if (!auth) return json({ error: 'Non autorisé' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Non autorisé' }, 401)

    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return json({ error: 'Accès refusé — droits admin requis' }, 403)
  }

  // ── Période ───────────────────────────────────────────────────────────────
  let periode: string
  try {
    const body = (await req.json().catch(() => ({}))) as { periode?: string }
    periode = (body.periode ?? '').trim() || previousMonthPeriode()
  } catch {
    periode = previousMonthPeriode()
  }

  if (!/^\d{4}-\d{2}$/.test(periode)) {
    return json({ error: 'Format période invalide — attendu YYYY-MM' }, 400)
  }

  // ── Idempotence ───────────────────────────────────────────────────────────
  const { count: existing } = await admin
    .from('recompenses_attribuees')
    .select('id', { count: 'exact', head: true })
    .eq('type_classement', 'mondial')
    .eq('periode', periode)

  if ((existing ?? 0) > 0) {
    return json({
      ok:      true,
      skipped: true,
      message: `Récompenses mondiale ${periode} déjà attribuées (${existing} entrées existantes)`,
    })
  }

  // ── Classement final ──────────────────────────────────────────────────────
  const { data: rawWinners, error: classErr } = await admin
    .from('classements')
    .select('rang, points, prestataire_id')
    .eq('type', 'mondial')
    .eq('periode', periode)
    .eq('est_actif', true)
    .gt('points', 0)
    .order('rang', { ascending: true })
    .limit(40)

  if (classErr) throw new Error(classErr.message)

  const winners = (rawWinners ?? []).filter(
    (w): w is Winner => !!w.prestataire_id,
  )

  if (winners.length === 0) {
    return json({
      ok:      false,
      message: `Aucun classement mondial trouvé pour ${periode}. pg_cron lassi-classements-mois-final a-t-il tourné le 1er du mois ?`,
    }, 404)
  }

  // ── Construire les lignes de récompense ───────────────────────────────────
  const expiryActif = valideJusquaActif(periode)
  const rows: RecompenseRow[] = []

  for (const w of winners) {
    const palier = getPalier(w.rang)
    if (!palier) continue
    // Rangs 1-10 ont des perks actifs (carrousel, prioriteRecherche, crédit) →
    // ils expirent fin du mois suivant pour laisser la place aux nouveaux gagnants.
    // Rangs 11-40 (badge/cert pur) → permanents.
    const hasActivePerks =
      palier.carrouselProduits > 0 ||
      palier.prioriteRecherche ||
      palier.creditLassi > 0

    rows.push({
      prestataire_id:     w.prestataire_id,
      client_id:          null,
      type_classement:    'mondial',
      periode,
      rang:               w.rang,
      badge:              palier.badge,
      certificat:         palier.certificat,
      priorite_recherche: palier.prioriteRecherche,
      credit_lassi:       palier.creditLassi,
      carrousel_produits: palier.carrouselProduits,
      top_vip:            false,
      valide_jusqu_a:     hasActivePerks ? expiryActif : null,
      est_actif:          true,
    })
  }

  if (rows.length === 0) {
    return json({ ok: false, message: 'Aucun gagnant éligible (prestataire_id manquant)' }, 500)
  }

  // ── Insérer ───────────────────────────────────────────────────────────────
  const { error: insertErr } = await admin.from('recompenses_attribuees').insert(rows)
  if (insertErr) throw new Error(`Insert récompenses : ${insertErr.message}`)

  // ── Créditer les portefeuilles ─────────────────────────────────────────────
  // increment_shop_credit(p_shop_id UUID, p_amount INT) attend shops.id (pas merchant_id).
  let credited = 0
  for (const row of rows) {
    if (row.credit_lassi <= 0) continue

    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('merchant_id', row.prestataire_id)
      .maybeSingle()

    if (!shop?.id) {
      console.warn(`[attribuer-recompenses-mondial] boutique introuvable pour prestataire ${row.prestataire_id} (rang ${row.rang})`)
      continue
    }

    const { error: creditErr } = await admin.rpc('increment_shop_credit', {
      p_shop_id: shop.id,
      p_amount:  row.credit_lassi,
    })

    if (creditErr) {
      console.error(`[attribuer-recompenses-mondial] crédit erreur rang ${row.rang}:`, creditErr.message)
    } else {
      credited++
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const moisLabel = labelMois(periode)

  for (const row of rows) {
    const palier = getPalier(row.rang)!

    const title = row.rang <= 3
      ? `Classement ${moisLabel} — Félicitations`
      : `Classement ${moisLabel} — Vos résultats`

    const details: string[] = [`Badge : ${palier.badge}`]
    if (palier.creditLassi > 0)       details.push(`${palier.creditLassi} FCFA de crédit LASSI`)
    if (palier.carrouselProduits > 0) details.push(`${palier.carrouselProduits} slot${palier.carrouselProduits > 1 ? 's' : ''} Offre du Quartier`)
    if (palier.certificat)            details.push('certificat partageable')

    const body = `Vous terminez ${row.rang}e du classement national ${moisLabel}. ${details.join(' · ')}.`

    try {
      await admin.from('notifications').insert({
        user_id: row.prestataire_id,
        type:    'vip',
        title,
        body,
        data:    { type_classement: 'mondial', periode, rang: row.rang },
      })
      await sendPushToUser(admin, row.prestataire_id, {
        title,
        body,
        data:      { type: 'classement', type_classement: 'mondial', periode, rang: row.rang },
        channelId: 'classement',
      })
    } catch (notifErr) {
      console.error(`[attribuer-recompenses-mondial] notif erreur rang ${row.rang}:`, notifErr)
    }
  }

  return json({
    ok:       true,
    periode,
    gagnants: rows.length,
    credited,
  })
})
