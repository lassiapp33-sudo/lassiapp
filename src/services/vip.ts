import { supabase, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
import {
  VipCategorie,
  VipFiche,
  VipHoraire,
  VipListeItem,
  VipProfil,
  VipPrestation,
} from '../types/vip';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function rowToProfil(r: Record<string, any>): VipProfil {
  return {
    id: r.id,
    shopId: r.shop_id,
    categorie: r.categorie,
    initiale: r.initiale,
    nomAffiche: r.nom_affiche,
    baseline: r.baseline ?? null,
    adresseCourte: r.adresse_courte ?? null,
    motDuGerant: r.mot_du_gerant ?? null,
    signatureMot: r.signature_mot ?? null,
    gabarit: r.gabarit ?? 'palais',
    actif: Boolean(r.actif),
    updatedAt: r.updated_at,
  };
}

function rowToPrestation(r: Record<string, any>): VipPrestation {
  return {
    id: r.id,
    vipProfilId: r.vip_profil_id,
    section: r.section ?? 'carte',
    nom: r.nom,
    description: r.description ?? null,
    prix: Number(r.prix),
    prixBarre: r.prix_barre != null ? Number(r.prix_barre) : null,
    unite: r.unite ?? null,
    mention: r.mention ?? null,
    estSignature: Boolean(r.est_signature),
    disponible: Boolean(r.disponible),
    ordre: Number(r.ordre ?? 0),
    createdAt: r.created_at,
  };
}

function rowToHoraire(r: Record<string, any>): VipHoraire {
  return {
    id: r.id,
    vipProfilId: r.vip_profil_id,
    jour: r.jour as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    ouverture: r.ouverture ?? null,
    fermeture: r.fermeture ?? null,
    ferme: Boolean(r.ferme),
    note: r.note ?? null,
  };
}

function rowToListeItem(r: Record<string, any>): VipListeItem {
  return {
    vipProfilId: r.vip_profil_id,
    shopId: r.shop_id,
    nomAffiche: r.nom_affiche,
    baseline: r.baseline ?? null,
    adresseCourte: r.adresse_courte ?? null,
    initiale: r.initiale,
    gabarit: r.gabarit ?? 'palais',
    categorie: r.categorie,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    rating: Number(r.rating ?? 0),
    estOuvert: Boolean(r.est_ouvert),
  };
}

function ficheFromJson(raw: any): VipFiche {
  const p = raw.profil;
  const s = raw.shop;
  return {
    profil: rowToProfil(p),
    prestations: (raw.prestations ?? []).map(rowToPrestation),
    horaires: (raw.horaires ?? []).map(rowToHoraire),
    shop: {
      id: s.id,
      name: s.name,
      rating: Number(s.rating ?? 0),
      reviewsCount: Number(s.reviews_count ?? 0),
      isManuallyClose: Boolean(s.is_manually_closed),
      logoUrl: s.logo_url ?? null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
    },
  };
}

// ─── Lecture publique (anon) ──────────────────────────────────────────────────

export async function getVipListe(categorie?: VipCategorie): Promise<VipListeItem[]> {
  try {
    const params = new URLSearchParams();
    if (categorie) params.set('p_categorie', categorie);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_vip_liste${qs}`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categorie ? { p_categorie: categorie } : {}),
      },
    );
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    return (data ?? []).map(rowToListeItem);
  } catch {
    return [];
  }
}

export async function getVipFiche(shopId: string): Promise<VipFiche | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_vip_fiche`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_shop_id: shopId }),
      },
    );
    if (!res.ok) return null;
    const raw = await res.json();
    if (!raw?.profil) return null;
    return ficheFromJson(raw);
  } catch {
    return null;
  }
}

// ─── Gérant : liaison de compte ───────────────────────────────────────────────

export async function lierGerantVip(): Promise<string | null> {
  const { data, error } = await supabase.rpc('lier_gerant_vip');
  if (error || !data) return null;
  return data as string;
}

export async function getMonProfilVip(): Promise<VipProfil | null> {
  const { data, error } = await supabase
    .from('vip_profils')
    .select('*')
    .single();
  if (error || !data) return null;
  return rowToProfil(data as Record<string, any>);
}

// ─── Gérant : prestations ────────────────────────────────────────────────────

export interface UpsertPrestationParams {
  id?: string;
  vipProfilId: string;
  section: string;
  nom: string;
  description?: string;
  prix: number;
  prixBarre?: number;
  unite?: string;
  mention?: string;
  estSignature?: boolean;
  disponible?: boolean;
  ordre?: number;
}

export async function upsertPrestation(p: UpsertPrestationParams): Promise<VipPrestation> {
  const payload = {
    ...(p.id ? { id: p.id } : {}),
    vip_profil_id: p.vipProfilId,
    section: p.section,
    nom: p.nom,
    description: p.description ?? null,
    prix: p.prix,
    prix_barre: p.prixBarre ?? null,
    unite: p.unite ?? null,
    mention: p.mention ?? null,
    est_signature: p.estSignature ?? false,
    disponible: p.disponible ?? true,
    ordre: p.ordre ?? 0,
  };

  const { data, error } = await supabase
    .from('vip_prestations')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToPrestation(data as Record<string, any>);
}

export async function toggleDisponibilite(id: string, disponible: boolean): Promise<void> {
  const { error } = await supabase
    .from('vip_prestations')
    .update({ disponible })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePrestation(id: string): Promise<void> {
  const { error } = await supabase
    .from('vip_prestations')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Gérant : horaires ───────────────────────────────────────────────────────

export interface UpsertHoraireParams {
  vipProfilId: string;
  jour: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  ouverture?: string;
  fermeture?: string;
  ferme?: boolean;
  note?: string;
}

export async function upsertHoraire(p: UpsertHoraireParams): Promise<VipHoraire> {
  const { data, error } = await supabase
    .from('vip_horaires')
    .upsert(
      {
        vip_profil_id: p.vipProfilId,
        jour: p.jour,
        ouverture: p.ouverture ?? null,
        fermeture: p.fermeture ?? null,
        ferme: p.ferme ?? false,
        note: p.note ?? null,
      },
      { onConflict: 'vip_profil_id,jour' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToHoraire(data as Record<string, any>);
}

// ─── Gérant : champs éditoriaux du profil ────────────────────────────────────

export interface UpdateProfilEditorialParams {
  motDuGerant?: string;
  signatureMot?: string;
  baseline?: string;
  adresseCourte?: string;
}

export async function updateProfilEditorial(
  profilId: string,
  p: UpdateProfilEditorialParams,
): Promise<void> {
  const { error } = await supabase
    .from('vip_profils')
    .update({
      mot_du_gerant: p.motDuGerant,
      signature_mot: p.signatureMot,
      baseline: p.baseline,
      adresse_courte: p.adresseCourte,
    })
    .eq('id', profilId);
  if (error) throw new Error(error.message);
}
