/**
 * services/annonces.ts — Gestion des annonces système diffusées dans l'app
 * (modale plein écran type "patch notes", cf. AnnonceModal + useAnnonces côté
 * mobile). Écriture autorisée par la policy annonces_admin_write
 * (profiles.is_admin = true) — pas d'Edge Function nécessaire.
 */
import { supabase } from '../lib/supabase'

export type AnnonceAudience = 'tous' | 'prestataires' | 'clients'

export interface Annonce {
  id:        string
  titre:     string
  corps:     string
  icone:     string
  tag:       string | null
  audience:  AnnonceAudience
  estActif:  boolean
  expireAt:  string | null
  createdAt: string
}

function rowToAnnonce(row: any): Annonce {
  return {
    id:        row.id,
    titre:     row.titre,
    corps:     row.corps,
    icone:     row.icone,
    tag:       row.tag,
    audience:  row.audience,
    estActif:  row.est_actif,
    expireAt:  row.expire_at,
    createdAt: row.created_at,
  }
}

// ─── Liste de toutes les annonces (les plus récentes en premier) ─────────────

export async function getAnnonces(): Promise<Annonce[]> {
  const { data, error } = await supabase
    .from('annonces')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToAnnonce)
}

// ─── Création d'une annonce personnalisée ────────────────────────────────────

export interface CreerAnnonceParams {
  titre:      string
  corps:      string
  icone?:     string
  tag?:       string | null
  audience:   AnnonceAudience
  expireDans?: number | null // en heures, null/undefined = jamais
}

export async function creerAnnoncePersonnalisee(params: CreerAnnonceParams): Promise<void> {
  const expireAt = params.expireDans
    ? new Date(Date.now() + params.expireDans * 3600_000).toISOString()
    : null

  const { error } = await supabase.from('annonces').insert({
    titre:     params.titre,
    corps:     params.corps,
    icone:     params.icone || '📢',
    tag:       params.tag || null,
    audience:  params.audience,
    expire_at: expireAt,
  })

  if (error) throw new Error(error.message)
}

// ─── Activer / désactiver une annonce ────────────────────────────────────────

export async function desactiverAnnonce(id: string): Promise<void> {
  const { error } = await supabase.from('annonces').update({ est_actif: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reactiverAnnonce(id: string): Promise<void> {
  const { error } = await supabase.from('annonces').update({ est_actif: true }).eq('id', id)
  if (error) throw new Error(error.message)
}
