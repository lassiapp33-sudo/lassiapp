import { supabase } from '../lib/supabase'

const SUPABASE_URL       = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type VipCategorie =
  | 'restauration'
  | 'musculation_fitness'
  | 'boulangerie_patisserie'
  | 'beaute_tressage'
  | 'coiffure'

export const VIP_CAT_LABELS: Record<VipCategorie, string> = {
  restauration:          'Restauration',
  musculation_fitness:   'Fitness',
  boulangerie_patisserie:'Boulangerie / Pâtisserie',
  beaute_tressage:       'Salon de beauté',
  coiffure:              'Salon de coiffure',
}

export interface Vip5EtoilesProfil {
  id:           string
  shopId:       string
  shopName:     string
  categorie:    VipCategorie
  gabarit:      'palais' | 'maison'
  nomAffiche:   string
  baseline:     string | null
  actif:        boolean
  gerantUserId: string | null
  updatedAt:    string
}

export async function getVip5EtoilesProfils(): Promise<Vip5EtoilesProfil[]> {
  const { data, error } = await supabase
    .from('vip_profils')
    .select(`
      id, shop_id, categorie, gabarit, nom_affiche, baseline, actif,
      gerant_user_id, updated_at,
      shops!inner ( name )
    `)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id:           r.id,
    shopId:       r.shop_id,
    shopName:     r.shops?.name ?? '—',
    categorie:    r.categorie,
    gabarit:      r.gabarit ?? 'palais',
    nomAffiche:   r.nom_affiche,
    baseline:     r.baseline ?? null,
    actif:        Boolean(r.actif),
    gerantUserId: r.gerant_user_id ?? null,
    updatedAt:    r.updated_at,
  }))
}

export async function toggleActif(profilId: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from('vip_profils')
    .update({ actif })
    .eq('id', profilId)
  if (error) throw new Error(error.message)
}

export async function supprimerProfil(profilId: string, shopId: string): Promise<void> {
  const { error } = await supabase
    .from('vip_profils')
    .delete()
    .eq('id', profilId)
  if (error) throw new Error(error.message)
  // La migration trg_vip_reset_shop_flag remet shops.is_vip = false automatiquement
  // Mais on le force aussi ici pour la cohérence immédiate en cas de trigger manquant
  await supabase.from('shops').update({ is_vip: false }).eq('id', shopId).throwOnError()
}

export async function creerProfilComplet(params: {
  telephone:  string
  motDePasse: string
  nomAffiche: string
  categorie:  VipCategorie
  gabarit:    'palais' | 'maison'
  initiale:   string
  baseline?:  string
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Session expirée, reconnectez-vous.')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-vip-gerant`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey':        SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur serveur')
}
