import { supabase } from '../lib/supabase';

export interface Livraison {
  id: string;
  demandeurId: string;
  demandeurType: 'client' | 'prestataire';
  orderId?: string;
  departLabel: string;
  departLat: number;
  departLng: number;
  arriveeLabel: string;
  arriveeLat: number;
  arriveeLng: number;
  contactNom?: string;
  contactTel?: string;
  distanceKm: number;
  prixLivraison: number;
  statut: 'en_attente' | 'acceptee' | 'terminee' | 'annulee';
  livreurId?: string;
  acceptedAt?: string;
  termineeAt?: string;
  createdAt: string;
}

function rowToLivraison(row: Record<string, any>): Livraison {
  return {
    id:             row.id,
    demandeurId:    row.demandeur_id,
    demandeurType:  row.demandeur_type,
    orderId:        row.order_id ?? undefined,
    departLabel:    row.depart_label,
    departLat:      row.depart_lat,
    departLng:      row.depart_lng,
    arriveeLabel:   row.arrivee_label,
    arriveeLat:     row.arrivee_lat,
    arriveeLng:     row.arrivee_lng,
    contactNom:     row.contact_nom ?? undefined,
    contactTel:     row.contact_tel ?? undefined,
    distanceKm:     Number(row.distance_km),
    prixLivraison:  row.prix_livraison,
    statut:         row.statut,
    livreurId:      row.livreur_id ?? undefined,
    acceptedAt:     row.accepted_at ?? undefined,
    termineeAt:     row.terminee_at ?? undefined,
    createdAt:      row.created_at,
  };
}

export interface CreerLivraisonParams {
  demandeurId: string;
  demandeurType: 'client' | 'prestataire';
  orderId?: string;
  departLabel: string;
  departLat: number;
  departLng: number;
  arriveeLabel: string;
  arriveeLat: number;
  arriveeLng: number;
  contactNom?: string;
  contactTel?: string;
  distanceKm: number;
  prixLivraison: number;
}

export async function creerLivraison(params: CreerLivraisonParams): Promise<Livraison> {
  const { data, error } = await supabase
    .from('livraisons')
    .insert({
      demandeur_id:   params.demandeurId,
      demandeur_type: params.demandeurType,
      order_id:       params.orderId ?? null,
      depart_label:   params.departLabel,
      depart_lat:     params.departLat,
      depart_lng:     params.departLng,
      arrivee_label:  params.arriveeLabel,
      arrivee_lat:    params.arriveeLat,
      arrivee_lng:    params.arriveeLng,
      contact_nom:    params.contactNom ?? null,
      contact_tel:    params.contactTel ?? null,
      distance_km:    params.distanceKm,
      prix_livraison: params.prixLivraison,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return rowToLivraison(data);
}

// Pour le livreur : livraisons en_attente + ses livraisons en cours
export async function getLivraisonsDisponibles(): Promise<Livraison[]> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*')
    .in('statut', ['en_attente', 'acceptee'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLivraison);
}

// Pour le demandeur : son historique
export async function getMesLivraisons(): Promise<Livraison[]> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLivraison);
}

export async function accepterLivraison(livraisonId: string): Promise<void> {
  const { error } = await supabase.rpc('accepter_livraison', {
    p_livraison_id: livraisonId,
  });
  if (error) throw new Error(error.message);
}

export async function terminerLivraison(livraisonId: string): Promise<void> {
  const { error } = await supabase.rpc('terminer_livraison', {
    p_livraison_id: livraisonId,
  });
  if (error) throw new Error(error.message);
}

// Pour l'admin
export async function getToutesLivraisons(): Promise<Livraison[]> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLivraison);
}
