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

export async function creerProfil(params: {
  shopId:     string
  categorie:  VipCategorie
  gabarit:    'palais' | 'maison'
  nomAffiche: string
  baseline?:  string
  initiale:   string
}): Promise<void> {
  // 1. Créer le profil VIP
  const { error } = await supabase.from('vip_profils').insert({
    shop_id:      params.shopId,
    categorie:    params.categorie,
    gabarit:      params.gabarit,
    nom_affiche:  params.nomAffiche,
    baseline:     params.baseline ?? null,
    initiale:     params.initiale,
    actif:        false,
  })
  if (error) throw new Error(error.message)

  // 2. Marquer la boutique comme VIP
  const { error: e2 } = await supabase
    .from('shops')
    .update({ is_vip: true })
    .eq('id', params.shopId)
  if (e2) throw new Error(e2.message)
}
