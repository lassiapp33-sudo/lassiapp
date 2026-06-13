/**
 * attribuer-recompenses-mondial — Edge Function déclenchée après calculer_classement_mondial()
 * (par pg_cron ou admin). Attribue les récompenses dégressives du top 40 mondial selon
 * les paliers de src/config/rewards.ts (PALIERS_MONDIAL) et diffuse une notif "ville"
 * pour le top 3.
 * Sécurisée par CRON_SECRET (cron) ou JWT admin (déclenchement manuel) — comme update-vip-rankings.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_BATCH_SIZE = 100

// Paliers (miroir de src/config/rewards.ts PALIERS_MONDIAL — garder synchro)
const PALIERS = [
  { min: 1,  max: 1,  badge: '👑 Champion Mondial', certificat: true,  priorite: true,  notif: true,  credit: 5000, carrousel: 5, newsletter: true },
  { min: 2,  max: 2,  badge: '🥈 Vice-Champion',    certificat: true,  priorite: true,  notif: true,  credit: 3000, carrousel: 4, newsletter: true },
  { min: 3,  max: 3,  badge: '🥉 3e Mondial',       certificat: true,  priorite: true,  notif: true,  credit: 2000, carrousel: 3, newsletter: true },
  { min: 4,  max: 4,  badge: '🏅 Top 4 Mondial',    certificat: true,  priorite: true,  notif: false, credit: 1000, carrousel: 2, newsletter: false },
  { min: 5,  max: 5,  badge: '🏅 Top 5 Mondial',    certificat: true,  priorite: true,  notif: false, credit: 1000, carrousel: 1, newsletter: false },
  { min: 6,  max: 10, badge: '⭐ Top 10 Mondial',   certificat: true,  priorite: true,  notif: false, credit: 500,  carrousel: 0, newsletter: false },
  { min: 11, max: 20, badge: '📈 Top 20 Mondial',   certificat: true,  priorite: false, notif: false, credit: 0,    carrousel: 0, newsletter: false },
  { min: 21, max: 40, badge: '📋 Top 40 Mondial',   certificat: false, priorite: false, notif: false, credit: 0,    carrousel: 0, newsletter: false },
]

function ordinal(rang: number): string {
  return rang === 1 ? '1er' : `${rang}e`
}

// Description FR des avantages d'un palier, pour la notification "mérite"
function describeRecompenses(p: typeof PALIERS[number]): string {
  const items: string[] = [`le badge ${p.badge}`]
  if (p.certificat) items.push('un certificat de reconnaissance partageable')
  if (p.priorite) items.push('une priorité dans les résultats de recherche')
  if (p.credit > 0) items.push(`${p.credit} FCFA de crédit LASSI`)
  if (p.carrousel > 0) items.push(`${p.carrousel} emplacement${p.carrousel > 1 ? 's' : ''} dans l'Offre di Quartier`)
  if (p.newsletter) items.push('une mise en avant dans notre newsletter')
  return items.join(', ')
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // --- Authentification : CRON_SECRET (pg_cron) ou JWT admin (déclenchement manuel) ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return jsonResponse({ error: 'Admin requis' }, 403)
  }

  // --- Paramètres ---
  let periode: string | undefined
  try {
    const body = await req.json()
    periode = body?.periode
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide' }, 400)
  }

  if (typeof periode !== 'string' || !/^\d{4}-\d{2}$/.test(periode)) {
    return jsonResponse({ error: 'periode invalide (attendu YYYY-MM)' }, 400)
  }

  // --- Idempotence : si déjà attribué pour cette période, ne pas dupliquer
  //     les récompenses ni renvoyer les notifs (retry GitHub Actions, etc.) ---
  const { count: dejaAttribue } = await supabase
    .from('recompenses_attribuees')
    .select('id', { count: 'exact', head: true })
    .eq('type_classement', 'mondial')
    .eq('periode', periode)
    .eq('est_actif', true)

  if (dejaAttribue && dejaAttribue > 0) {
    return jsonResponse({ success: true, skipped: true, reason: 'Récompenses déjà attribuées pour cette période' })
  }

  // --- Lire le classement mondial actif (calculé par calculer_classement_mondial) ---
  const { data: classement, error: classementErr } = await supabase
    .from('classements')
    .select('prestataire_id, rang, nom_affiche')
    .eq('type', 'mondial')
    .eq('periode', periode)
    .eq('est_actif', true)
    .order('rang')

  if (classementErr) return jsonResponse({ error: classementErr.message }, 500)
  if (!classement || classement.length === 0) {
    return jsonResponse({ error: 'Pas de classement actif pour cette période' }, 404)
  }

  const validJusqua = new Date()
  validJusqua.setMonth(validJusqua.getMonth() + 1)

  const messagesVille: string[] = []
  const notificationsMerite: { user_id: string; type: string; title: string; body: string; data: Record<string, unknown> }[] = []

  for (const entry of classement) {
    const palier = PALIERS.find(p => entry.rang >= p.min && entry.rang <= p.max)
    if (!palier) continue

    // Attribuer la récompense. credit_lassi est enregistré ici comme référence —
    // le créditage effectif d'un portefeuille interne nécessite un système de
    // wallet/ledger qui n'existe pas encore (phase future).
    await supabase.from('recompenses_attribuees').insert({
      prestataire_id: entry.prestataire_id,
      type_classement: 'mondial',
      periode,
      rang: entry.rang,
      badge: palier.badge,
      certificat: palier.certificat,
      priorite_recherche: palier.priorite,
      credit_lassi: palier.credit,
      carrousel_produits: palier.carrousel,
      valide_jusqu_a: validJusqua.toISOString(),
      est_actif: true,
    })

    // Notification personnelle "mérite" — tout le top 40 reçoit son palier
    notificationsMerite.push({
      user_id: entry.prestataire_id,
      type: 'vip',
      title: '🏆 Félicitations pour votre classement mondial !',
      body: `Grâce à votre travail et à la confiance de vos clients, vous terminez ${ordinal(entry.rang)} au classement Mondial LASSI de ce mois-ci. Vous obtenez ${describeRecompenses(palier)}. Continuez sur cette lancée pour gagner encore plus de récompenses le mois prochain !`,
      data: { type_classement: 'mondial', periode, rang: entry.rang },
    })

    // Notification ville (top 3)
    if (palier.notif) {
      const nom = entry.nom_affiche ?? 'Un prestataire'
      messagesVille.push(`${nom} est ${palier.badge} ce mois-ci ! 🎉`)
    }
  }

  if (notificationsMerite.length > 0) {
    await supabase.from('notifications').insert(notificationsMerite)
  }

  // --- Diffuser les notifs ville à tous les utilisateurs avec un push token Expo ---
  let notifsEnvoyees = 0
  if (messagesVille.length > 0) {
    const { data: tokens } = await supabase
      .from('profiles')
      .select('push_token')
      .not('push_token', 'is', null)

    const pushTokens = (tokens ?? [])
      .map(t => t.push_token as string)
      .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))

    for (const message of messagesVille) {
      for (let i = 0; i < pushTokens.length; i += EXPO_BATCH_SIZE) {
        const batch = pushTokens.slice(i, i + EXPO_BATCH_SIZE).map(to => ({
          to,
          title: '🏆 Champion LASSİ !',
          body: message,
          sound: 'default',
        }))
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch),
        })
        if (res.ok) notifsEnvoyees += batch.length
      }
    }
  }

  return jsonResponse({ success: true, attribues: classement.length, notifsMerite: notificationsMerite.length, notifications: notifsEnvoyees })
})
