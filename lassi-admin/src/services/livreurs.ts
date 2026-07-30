/**
 * services/livreurs.ts — Gestion des livreurs internes (admin).
 * La création de compte passe par une Edge Function avec service_role.
 */
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminLivreur {
  id:          string
  nomComplet:  string
  telephone:   string
  actif:       boolean
  createdAt:   string
}

export interface AdminLivraison {
  id:            string
  demandeurType: string
  departLabel:   string
  arriveeLabel:  string
  contactNom:    string | null
  contactTel:    string | null
  distanceKm:    number
  prixLivraison: number
  statut:        string
  livreurId:     string | null
  createdAt:     string
  termineeAt:    string | null
}

export interface TotalLivreur {
  livreurId:   string
  nomComplet:  string
  telephone:   string
  nbTerminees: number
  totalAPayer: number
}

export interface VersementLivreur {
  id:              string
  livreurId:       string
  montantBrut:     number
  commissionLassi: number
  montantNet:      number
  nbCourses:       number
  createdAt:       string
}

export interface SoldeLivreur {
  livreurId:          string
  nomComplet:         string
  telephone:          string
  actif:              boolean
  montantBrut:        number
  commissionLassi:    number
  montantNet:         number
  nbCourses:          number
  dernierVersementAt: string | null
}

// ─── Livreurs ─────────────────────────────────────────────────────────────────

export async function getLivreurs(): Promise<AdminLivreur[]> {
  const { data, error } = await supabase
    .from('livreurs')
    .select('id, nom_complet, telephone, actif, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:         row.id,
    nomComplet: row.nom_complet,
    telephone:  row.telephone,
    actif:      row.actif,
    createdAt:  row.created_at,
  }))
}

export async function toggleLivreurActif(livreurId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from('livreurs')
    .update({ actif })
    .eq('id', livreurId)

  if (error) throw new Error(error.message)
}

/** Retourne l'identifiant (numéro de tél normalisé) à communiquer au livreur. */
export async function creerCompteLivreur(params: {
  nomComplet: string
  telephone:  string
  motDePasse: string
}): Promise<{ livreurId: string; identifiant: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-livreur`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(params),
    },
  )

  let json: Record<string, unknown> = {}
  try { json = await res.json() } catch { /* réponse non-JSON (ex: 404 HTML) */ }

  if (!res.ok) {
    const msg = typeof json.error === 'string' && json.error
      ? json.error
      : typeof json.message === 'string' && json.message
      ? json.message
      : `Erreur ${res.status} — impossible de créer le compte livreur`
    throw new Error(msg)
  }

  return {
    livreurId:   json.livreurId  as string,
    identifiant: json.identifiant as string,
  }
}

// ─── Livraisons (vue admin) ────────────────────────────────────────────────────

export async function getLivraisons(): Promise<AdminLivraison[]> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:            row.id,
    demandeurType: row.demandeur_type,
    departLabel:   row.depart_label,
    arriveeLabel:  row.arrivee_label,
    contactNom:    row.contact_nom ?? null,
    contactTel:    row.contact_tel ?? null,
    distanceKm:    Number(row.distance_km),
    prixLivraison: row.prix_livraison,
    statut:        row.statut,
    livreurId:     row.livreur_id ?? null,
    createdAt:     row.created_at,
    termineeAt:    row.terminee_at ?? null,
  }))
}

// ─── Versements ───────────────────────────────────────────────────────────────

export async function getVersements(): Promise<VersementLivreur[]> {
  const { data, error } = await supabase
    .from('versements_livreurs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:              row.id,
    livreurId:       row.livreur_id,
    montantBrut:     row.montant_brut,
    commissionLassi: row.commission_lassi,
    montantNet:      row.montant_net,
    nbCourses:       row.nb_courses,
    createdAt:       row.created_at,
  }))
}

export async function supprimerLivreur(livreurId: string): Promise<void> {
  const { error } = await supabase
    .from('livreurs')
    .delete()
    .eq('id', livreurId)
  if (error) throw new Error(error.message)
}

export async function supprimerLivraison(livraisonId: string): Promise<void> {
  const { error } = await supabase
    .from('livraisons')
    .delete()
    .eq('id', livraisonId)
  if (error) throw new Error(error.message)
}

export async function annulerLivraison(livraisonId: string): Promise<void> {
  const { error } = await supabase
    .from('livraisons')
    .update({ statut: 'annulee' })
    .eq('id', livraisonId)
  if (error) throw new Error(error.message)
}

export async function marquerLivreurVerse(livreurId: string): Promise<void> {
  const { error } = await supabase.rpc('marquer_livreur_verse', { p_livreur_id: livreurId })
  if (error) {
    if (error.message.includes('SOLDE_ZERO')) throw new Error('Ce livreur n\'a aucun solde à verser.')
    if (error.message.includes('NON_AUTORISE')) throw new Error('Action non autorisée.')
    throw new Error(error.message)
  }
}

/**
 * Calcule le solde actuel non versé par livreur.
 * Solde = sum(courses terminées depuis le dernier versement).
 */
export function getSoldesActuels(
  livraisons:  AdminLivraison[],
  livreurs:    AdminLivreur[],
  versements:  VersementLivreur[],
): SoldeLivreur[] {
  // Date du dernier versement par livreur
  const dernierVersementAt = new Map<string, string>()
  for (const v of versements) {
    const existing = dernierVersementAt.get(v.livreurId)
    if (!existing || v.createdAt > existing) {
      dernierVersementAt.set(v.livreurId, v.createdAt)
    }
  }

  // Cumul des courses non encore versées
  const byLivreur = new Map<string, { nb: number; brut: number }>()
  for (const l of livraisons) {
    if (l.statut !== 'terminee' || !l.livreurId || !l.termineeAt) continue
    const lastPaid = dernierVersementAt.get(l.livreurId)
    if (lastPaid && l.termineeAt <= lastPaid) continue
    const cur = byLivreur.get(l.livreurId) ?? { nb: 0, brut: 0 }
    byLivreur.set(l.livreurId, { nb: cur.nb + 1, brut: cur.brut + l.prixLivraison })
  }

  return livreurs
    .map(l => {
      const stats     = byLivreur.get(l.id) ?? { nb: 0, brut: 0 }
      const commission = Math.round(stats.brut * 0.10)
      return {
        livreurId:          l.id,
        nomComplet:         l.nomComplet,
        telephone:          l.telephone,
        actif:              l.actif,
        montantBrut:        stats.brut,
        commissionLassi:    commission,
        montantNet:         stats.brut - commission,
        nbCourses:          stats.nb,
        dernierVersementAt: dernierVersementAt.get(l.id) ?? null,
      }
    })
    .sort((a, b) => b.montantBrut - a.montantBrut)
}

/**
 * Totaux à payer par livreur sur une période.
 * On filtre côté client sur les livraisons terminées (depuis / jusqu inclus).
 */
export function getTotauxParLivreur(
  livraisons: AdminLivraison[],
  livreurs:   AdminLivreur[],
  depuis:     string,
  jusqua:     string,
): TotalLivreur[] {
  const debut = new Date(depuis).getTime()
  const fin   = new Date(jusqua).getTime() + 86_400_000 // fin de journée

  const byLivreur = new Map<string, { nb: number; total: number }>()

  for (const l of livraisons) {
    if (
      l.statut !== 'terminee' ||
      !l.livreurId ||
      !l.termineeAt
    ) continue

    const ts = new Date(l.termineeAt).getTime()
    if (ts < debut || ts > fin) continue

    const existing = byLivreur.get(l.livreurId) ?? { nb: 0, total: 0 }
    byLivreur.set(l.livreurId, {
      nb:    existing.nb + 1,
      total: existing.total + l.prixLivraison,
    })
  }

  return livreurs
    .filter(l => byLivreur.has(l.id))
    .map(l => {
      const stats = byLivreur.get(l.id)!
      return {
        livreurId:   l.id,
        nomComplet:  l.nomComplet,
        telephone:   l.telephone,
        nbTerminees: stats.nb,
        totalAPayer: stats.total,
      }
    })
    .sort((a, b) => b.totalAPayer - a.totalAPayer)
}
