import { supabase } from '../lib/supabase';
import { devisLivraison } from '../config/livraison';

export { devisLivraison };

export interface Livraison {
  id: string;
  demandeur_id: string;
  demandeur_type: 'client' | 'prestataire';
  order_id: string | null;
  depart_label: string;
  depart_lat: number;
  depart_lng: number;
  arrivee_label: string;
  arrivee_lat: number;
  arrivee_lng: number;
  contact_nom: string | null;
  contact_tel: string | null;
  distance_km: number;
  prix_livraison: number;
  statut: 'en_attente' | 'acceptee' | 'terminee' | 'annulee';
  livreur_id: string | null;
  created_at: string;
  terminee_at: string | null;
}

// Créer une demande de livraison
export const creerLivraison = async (params: {
  demandeurType: 'client' | 'prestataire';
  orderId?: string;
  departLabel: string; departLat: number; departLng: number;
  arriveeLabel: string; arriveeLat: number; arriveeLng: number;
  contactNom?: string; contactTel?: string;
}): Promise<{ success: true; livraison: Livraison; prix: number } | { success: false; error: string }> => {
  const devis = devisLivraison(
    params.departLat, params.departLng,
    params.arriveeLat, params.arriveeLng,
  );
  if (devis.horsZone) return { success: false, error: devis.message ?? 'Zone non couverte.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non connecté.' };

  const { data, error } = await supabase
    .from('livraisons')
    .insert({
      demandeur_id:   user.id,
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
      distance_km:    devis.distanceKm,
      prix_livraison: devis.prix,
    })
    .select()
    .single();

  if (error) return { success: false, error: 'Erreur création livraison.' };
  return { success: true, livraison: data as Livraison, prix: devis.prix };
};

// DEMANDEUR (client ou prestataire) : mon historique de livraisons
export const getLivraisonsDemandeur = async (): Promise<Livraison[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('livraisons')
    .select('*')
    .eq('demandeur_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as Livraison[];
};

// LIVREUR : livraisons en attente (pool)
export const getLivraisonsDisponibles = async (): Promise<Livraison[]> => {
  const { data } = await supabase
    .from('livraisons')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
    .limit(30);
  return (data ?? []) as Livraison[];
};

// LIVREUR : mes livraisons en cours (acceptée par moi)
export const getMesLivraisons = async (): Promise<Livraison[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('livraisons')
    .select('*')
    .eq('livreur_id', user.id)
    .eq('statut', 'acceptee')
    .order('accepted_at', { ascending: false });
  return (data ?? []) as Livraison[];
};

// LIVREUR : accepter
export const accepterLivraison = async (
  livraisonId: string,
): Promise<{ success: true } | { success: false; error: string }> => {
  const { error } = await supabase.rpc('accepter_livraison', { p_livraison_id: livraisonId });
  if (error) {
    if (error.message.includes('DEJA_PRISE'))
      return { success: false, error: 'Cette livraison vient d\'être prise par un autre livreur.' };
    if (error.message.includes('NON_AUTORISE'))
      return { success: false, error: 'Votre compte livreur n\'est pas encore activé. Contactez l\'administrateur.' };
    return { success: false, error: 'Impossible d\'accepter. Réessaie ou contacte le support.' };
  }
  return { success: true };
};

// LIVREUR : terminer
export const terminerLivraison = async (
  livraisonId: string,
): Promise<{ success: true } | { success: false; error: string }> => {
  const { error } = await supabase.rpc('terminer_livraison', { p_livraison_id: livraisonId });
  if (error) return { success: false, error: 'Impossible de terminer.' };
  return { success: true };
};

// LIVREUR : connexion par numéro de téléphone
export const connexionLivreur = async (
  telephone: string,
  motDePasse: string,
): Promise<{ success: true } | { success: false; error: string }> => {
  const tel = telephone.replace(/\D/g, '');
  const emailInterne = `livreur.${tel}@lassi.internal`;

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInterne,
    password: motDePasse,
  });

  if (error) return { success: false, error: 'Identifiants incorrects' };
  return { success: true };
};

// ─── Gains livreur ────────────────────────────────────────────────────────────

export interface VersementLivreurRow {
  id:              string;
  montant_brut:    number;
  commission_lassi: number;
  montant_net:     number;
  nb_courses:      number;
  created_at:      string;
}

/** Toutes les livraisons terminées du livreur connecté (historique complet). */
export const getMesLivraisonsTerminees = async (): Promise<Livraison[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('livraisons')
    .select('*')
    .eq('livreur_id', user.id)
    .eq('statut', 'terminee')
    .order('terminee_at', { ascending: false })
    .limit(200);
  return (data ?? []) as Livraison[];
};

/** Versements reçus par le livreur connecté. */
export const getMesVersements = async (): Promise<VersementLivreurRow[]> => {
  const { data } = await supabase
    .from('versements_livreurs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as VersementLivreurRow[];
};

/**
 * Calcule le solde non versé du livreur.
 * = sum des terminées depuis le dernier versement × 0.85 (net après commission 15%)
 */
export function calcSoldeNonVerse(
  livraisons: Livraison[],
  versements: VersementLivreurRow[],
): { nbCourses: number; montantBrut: number; montantNet: number } {
  const lastAt = versements.length > 0 ? versements[0].created_at : null;
  let brut = 0;
  let nb = 0;
  for (const l of livraisons) {
    if (!l.terminee_at) continue;
    if (lastAt && l.terminee_at <= lastAt) continue;
    brut += l.prix_livraison;
    nb++;
  }
  return { nbCourses: nb, montantBrut: brut, montantNet: Math.round(brut * 0.85) };
}

// ADMIN : créer un compte livreur via Edge Function (service_role requis)
export const creerCompteLivreur = async (params: {
  nomComplet: string;
  telephone:  string;
  motDePasse: string;
}): Promise<{ success: true; livreurId: string } | { success: false; error: string }> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Non connecté.' };

  const { data, error } = await supabase.functions.invoke('admin-create-livreur', {
    body: params,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.success)
    return { success: false, error: data?.error ?? 'Erreur création livreur.' };
  return { success: true, livreurId: data.livreurId };
};

// ADMIN : liste des livreurs
export const getLivreurs = async () => {
  const { data } = await supabase
    .from('livreurs')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
};

// ADMIN : activer / désactiver
export const toggleLivreur = async (livreurId: string, actif: boolean) => {
  const { error } = await supabase.from('livreurs').update({ actif }).eq('id', livreurId);
  return { success: !error };
};
