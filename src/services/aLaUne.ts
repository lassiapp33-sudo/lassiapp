import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import type { AlaUneBloc, AlaUneElement } from '../types/aLaUne';

function rowToBloc(row: Record<string, unknown>): AlaUneBloc {
  return {
    id: row.id as string,
    prestataireId: row.prestataire_id as string,
    titre: row.titre as string,
    description: (row.description as string | null) ?? null,
    categorieId: row.categorie_id as string,
    sousCategorieId: (row.sous_categorie_id as string | null) ?? null,
    elements: Array.isArray(row.elements) ? (row.elements as AlaUneElement[]) : [],
    actif: Boolean(row.actif),
    createdAt: row.created_at as string,
    expireAt: row.expire_at as string,
  };
}

export interface CreerBlocParams {
  titre: string;
  description?: string;
  categorieId: string;
  sousCategorieId?: string;
  elements: AlaUneElement[];
}

export async function creerBlocAlaUne(params: CreerBlocParams): Promise<string> {
  const { data, error } = await supabase.rpc('creer_a_la_une', {
    p_titre: params.titre,
    p_description: params.description ?? null,
    p_categorie_id: params.categorieId,
    p_sous_categorie_id: params.sousCategorieId ?? null,
    p_elements: params.elements,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function reactiverBlocAlaUne(blocId: string): Promise<string> {
  const { data, error } = await supabase.rpc('reactiver_a_la_une', {
    p_bloc_id: blocId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getMesBlocsAlaUne(): Promise<AlaUneBloc[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('a_la_une')
    .select('*')
    .eq('prestataire_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBloc);
}

export async function getBlocsAlaUneParCategorie(
  categorieId: string,
  sousCategorieId?: string,
): Promise<AlaUneBloc[]> {
  const now = new Date().toISOString();
  let q = supabase
    .from('a_la_une')
    .select('*')
    .eq('categorie_id', categorieId)
    .eq('actif', true)
    .gt('expire_at', now)
    .order('created_at', { ascending: false })
    .limit(20);

  if (sousCategorieId) {
    q = q.or(`sous_categorie_id.eq.${sousCategorieId},sous_categorie_id.is.null`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const blocs = (data ?? []).map(rowToBloc);

  if (blocs.length === 0) return blocs;

  const prestataireIds = [...new Set(blocs.map(b => b.prestataireId))];
  const { data: shops } = await supabase
    .from('shops')
    .select('merchant_id, name, logo_url')
    .in('merchant_id', prestataireIds);

  const shopMap: Record<string, { name: string; logoUrl: string | null }> = {};
  for (const s of shops ?? []) {
    shopMap[s.merchant_id] = { name: s.name, logoUrl: s.logo_url ?? null };
  }

  return blocs.map(b => ({
    ...b,
    shopName: shopMap[b.prestataireId]?.name,
    shopLogoUrl: shopMap[b.prestataireId]?.logoUrl ?? null,
  }));
}

export async function getQuotaRestant(): Promise<number> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('a_la_une')
    .select('*', { count: 'exact', head: true })
    .eq('prestataire_id', userId)
    .gte('created_at', today.toISOString());
  if (error) return 10;
  return Math.max(0, 10 - (count ?? 0));
}

export function buildShareMessage(params: {
  elementNom: string;
  elementPrix: number;
  blocTitre: string;
  blocDescription: string | null;
  shopName: string;
  blocId: string;
  expireAt: string;
}): string {
  const hoursLeft = Math.max(
    1,
    Math.ceil((new Date(params.expireAt).getTime() - Date.now()) / 3_600_000),
  );
  const prix = params.elementPrix.toLocaleString('fr-FR') + ' F';
  const lines = [
    `✨ *${params.elementNom}* — ${prix}`,
    `📌 ${params.blocTitre} · ${params.shopName}`,
  ];
  if (params.blocDescription) lines.push('', params.blocDescription);
  lines.push(
    '',
    `⏳ Offre valable encore ${hoursLeft}h`,
    `📲 Commande sur LASSİ :`,
    `lassiapp://a_la_une/${params.blocId}`,
    '',
    '─────────────────────',
    'Propulsé par LASSİ 🇸🇳',
  );
  return lines.join('\n');
}
