/**
 * services/livreurs.ts — Gestion des livreurs internes (admin).
 * La création de compte passe par une Edge Function avec service_role
 * (même pattern que admin-delete-user).
 */
import { supabase } from '../lib/supabase'

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
  acceptedAt:    string | null
  termineeAt:    string | null
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

export async function creerCompteLivreur(params: {
  nomComplet: string
  telephone:  string
  motDePasse: string
}): Promise<void> {
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

  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la création du compte livreur')
}

// ─── Livraisons (vue admin) ────────────────────────────────────────────────────

export async function getLivraisons(): Promise<AdminLivraison[]> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

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
    acceptedAt:    row.accepted_at ?? null,
    termineeAt:    row.terminee_at ?? null,
  }))
}
