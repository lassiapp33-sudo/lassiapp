import { supabase } from '../lib/supabase'

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
  id:              string
  shopId:          string
  shopName:        string
  categorie:       VipCategorie
  gabarit:         'palais' | 'maison'
  nomAffiche:      string
  baseline:        string | null
  actif:           boolean
  gerantUserId:    string | null
  telephoneGerant: string | null
  updatedAt:       string
}

export async function getVip5EtoilesProfils(): Promise<Vip5EtoilesProfil[]> {
  const { data, error } = await supabase
    .from('vip_profils')
    .select(`
      id, shop_id, categorie, gabarit, nom_affiche, baseline, actif,
      gerant_user_id, telephone_gerant, updated_at,
      shops!inner ( name )
    `)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r: any) => ({
    id:              r.id,
    shopId:          r.shop_id,
    shopName:        r.shops?.name ?? '—',
    categorie:       r.categorie,
    gabarit:         r.gabarit ?? 'palais',
    nomAffiche:      r.nom_affiche,
    baseline:        r.baseline ?? null,
    actif:           Boolean(r.actif),
    gerantUserId:    r.gerant_user_id ?? null,
    telephoneGerant: r.telephone_gerant ?? null,
    updatedAt:       r.updated_at,
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
  const { data, error } = await supabase.functions.invoke('create-vip-gerant', {
    body: params,
  })
  if (error) {
    // Extraire le vrai message depuis le body de la réponse HTTP
    try {
      const body = await (error as any).context?.json?.()
      if (body?.error) throw new Error(body.error)
    } catch (inner) {
      if (inner instanceof Error && inner.message !== error.message) throw inner
    }
    throw new Error(error.message ?? 'Erreur serveur')
  }
  if (data?.error) throw new Error(data.error)
}
