import { supabase, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FitnessOffre {
  id: string;
  prestataireId: string;
  nom: string;
  description?: string;
  prix: number;
  dureeJours: number;
  actif: boolean;
  createdAt: string;
}

export interface FitnessAbonnement {
  id: string;
  offreId: string;
  clientId: string;
  prestataireId: string;
  nomOffre: string;
  prixPaye: number;
  dateAchat: string;
  dateExpiration: string;
  statut: 'actif' | 'expire';
  paymentIntentId?: string;
  // Champs joints (optionnels selon la requête)
  prestataireName?: string;
  prestataireAvatar?: string;
  shopName?: string;
  shopLogo?: string;
  clientName?: string;
}

// ─── Mapping DB → TS ──────────────────────────────────────────────────────────

function rowToOffre(r: Record<string, unknown>): FitnessOffre {
  return {
    id:            r.id as string,
    prestataireId: r.prestataire_id as string,
    nom:           r.nom as string,
    description:   (r.description as string | null) ?? undefined,
    prix:          r.prix as number,
    dureeJours:    r.duree_jours as number,
    actif:         r.actif as boolean,
    createdAt:     r.created_at as string,
  };
}

type ShopEntry = { name: string; logo_url: string | null };

function rowToAbonnement(
  r: Record<string, unknown>,
  shopMap: Record<string, ShopEntry> = {},
): FitnessAbonnement {
  const prestataireId = r.prestataire_id as string;
  const shop = shopMap[prestataireId] ?? null;
  return {
    id:               r.id as string,
    offreId:          r.offre_id as string,
    clientId:         r.client_id as string,
    prestataireId,
    nomOffre:         r.nom_offre as string,
    prixPaye:         r.prix_paye as number,
    dateAchat:        r.date_achat as string,
    dateExpiration:   r.date_expiration as string,
    statut:           r.statut as 'actif' | 'expire',
    paymentIntentId:  (r.payment_intent_id as string | null) ?? undefined,
    shopName:         (shop?.name          as string | null) ?? undefined,
    shopLogo:         (shop?.logo_url      as string | null) ?? undefined,
  };
}

// ─── Offres (prestataire) ─────────────────────────────────────────────────────

/** Offres d'un fitness pour UN onglet spécifique (ou toutes si pas de tab). */
export async function getMesOffres(prestataireId: string, categoriTab?: string): Promise<FitnessOffre[]> {
  let query = supabase
    .from('fitness_abonnement_offres')
    .select('*')
    .eq('prestataire_id', prestataireId)
    .order('created_at', { ascending: false });
  if (categoriTab) {
    query = query.eq('categorie_tab', categoriTab);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOffre);
}

/** Offres actives d'un fitness — pour les clients. */
export async function getOffresActives(prestataireId: string): Promise<FitnessOffre[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/fitness_abonnement_offres?select=*&prestataire_id=eq.${encodeURIComponent(prestataireId)}&actif=eq.true&order=prix.asc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    return (data ?? []).map(rowToOffre);
  } catch {
    return [];
  }
}

/** Crée une offre d'abonnement liée à un onglet spécifique. */
export async function createOffre(
  prestataireId: string,
  data: Pick<FitnessOffre, 'nom' | 'description' | 'prix' | 'dureeJours'>,
  categoriTab?: string,
): Promise<FitnessOffre> {
  const { data: row, error } = await supabase
    .from('fitness_abonnement_offres')
    .insert({
      prestataire_id: prestataireId,
      nom:            data.nom.trim(),
      description:    data.description?.trim() || null,
      prix:           data.prix,
      duree_jours:    data.dureeJours,
      categorie_tab:  categoriTab ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToOffre(row);
}

/** Met à jour une offre. */
export async function updateOffre(
  offreId: string,
  updates: Partial<Pick<FitnessOffre, 'nom' | 'description' | 'prix' | 'dureeJours' | 'actif'>>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.nom         !== undefined) row.nom         = updates.nom.trim();
  if (updates.description !== undefined) row.description = updates.description?.trim() || null;
  if (updates.prix        !== undefined) row.prix        = updates.prix;
  if (updates.dureeJours  !== undefined) row.duree_jours = updates.dureeJours;
  if (updates.actif       !== undefined) row.actif       = updates.actif;
  const { error } = await supabase
    .from('fitness_abonnement_offres')
    .update(row)
    .eq('id', offreId);
  if (error) throw new Error(error.message);
}

/** Supprime une offre (impossible si des abonnements actifs y font référence). */
export async function deleteOffre(offreId: string): Promise<void> {
  const { error } = await supabase
    .from('fitness_abonnement_offres')
    .delete()
    .eq('id', offreId);
  if (error) throw new Error(error.message);
}

// ─── Abonnements client ────────────────────────────────────────────────────────

/** Abonnements d'un client (avec nom et logo de la boutique via shops.merchant_id). */
export async function getMesAbonnements(clientId: string): Promise<FitnessAbonnement[]> {
  const { data, error } = await supabase
    .from('fitness_abonnements_clients')
    .select('*')
    .eq('client_id', clientId)
    .order('date_achat', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const prestataireIds = [...new Set(rows.map(r => r.prestataire_id as string).filter(Boolean))];

  let shopMap: Record<string, ShopEntry> = {};
  if (prestataireIds.length > 0) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/shops?select=merchant_id,name,logo_url&merchant_id=in.(${prestataireIds.map(encodeURIComponent).join(',')})`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
      );
      if (res.ok) {
        const shops: Array<{ merchant_id: string; name: string; logo_url: string | null }> = await res.json();
        shopMap = Object.fromEntries(shops.map(s => [s.merchant_id, { name: s.name, logo_url: s.logo_url }]));
      }
    } catch {}
  }

  return rows.map(r => rowToAbonnement(r as Record<string, unknown>, shopMap));
}

/** Abonnés d'un fitness (avec nom réel du client via RPC SECURITY DEFINER). */
export async function getMesAbonnes(_prestataireId: string): Promise<FitnessAbonnement[]> {
  const { data, error } = await supabase.rpc('get_mes_abonnes');
  if (error) throw new Error(error.message);
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  return rows.map(r => ({
    id:               r.id as string,
    offreId:          r.offre_id as string,
    clientId:         r.client_id as string,
    prestataireId:    r.prestataire_id as string,
    nomOffre:         r.nom_offre as string,
    prixPaye:         r.prix_paye as number,
    dateAchat:        r.date_achat as string,
    dateExpiration:   r.date_expiration as string,
    statut:           r.statut as 'actif' | 'expire',
    paymentIntentId:  (r.payment_intent_id as string | null) ?? undefined,
    clientName:       (r.client_name as string | null) ?? undefined,
  }));
}

/** Onglets (categorie_tab) ayant au moins une offre pour ce prestataire. */
export async function getOffreTabs(prestataireId: string): Promise<string[]> {
  const { data } = await supabase
    .from('fitness_abonnement_offres')
    .select('categorie_tab')
    .eq('prestataire_id', prestataireId)
    .not('categorie_tab', 'is', null);
  const tabs = (data ?? []).map(r => r.categorie_tab as string).filter(Boolean);
  return [...new Set(tabs)];
}

/** Renvoie true si un onglet spécifique a des abonnés actifs. */
export async function hasActiveAbonnesForTab(categoriTab: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_active_abonnes_for_tab', {
      p_categorie_tab: categoriTab,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** Supprime toutes les offres d'un onglet (cascade sur abonnements clients). */
export async function deleteOffresForTab(categoriTab: string): Promise<void> {
  const { error } = await supabase.rpc('delete_offres_for_tab', {
    p_categorie_tab: categoriTab,
  });
  if (error) throw new Error(error.message);
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

/** Calcule les jours restants (0 si expiré). Utilise date_expiration locale. */
export function joursRestants(dateExpiration: string): number {
  const diff = new Date(dateExpiration).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** Détermine si un abonnement est expiré (côté UI, avant le cron). */
export function isExpireLocalement(abo: FitnessAbonnement): boolean {
  return abo.statut === 'expire' || new Date(abo.dateExpiration) < new Date();
}
