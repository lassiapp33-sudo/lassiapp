import { supabase, SUPABASE_URL } from '../lib/supabase';
import type { BlocALaUne, ElementALaUne } from '../types/aLaUne';
import { lienElement } from '../utils/deepLinks';

// ─── Upload image bloc vers Storage ──────────────────────────────────────────

export const uploadBlocImage = async (
  localUri: string,
): Promise<{ url: string } | { error: string }> => {
  // Session locale — pas de réseau, pas de table auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Non authentifié' };

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';

  // Lire le fichier en binaire
  const fileRes = await fetch(localUri);
  const arrayBuffer = await fileRes.arrayBuffer();

  // Appel Edge Function — upload côté serveur avec service_role
  // → bypass total du bug auth.platform_users
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/upload-bloc-image`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/octet-stream',
        'x-file-ext': ext,
      },
      body: arrayBuffer,
    },
  );

  const json = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok || json.error) return { error: json.error ?? 'Erreur upload' };
  return { url: json.url as string };
};

// ─── Créer un bloc ────────────────────────────────────────────────────────────

export const creerBloc = async (params: {
  titre: string;
  description?: string;
  categorieId: string;
  sousCategorieId?: string;
  elements: ElementALaUne[];
  imageUrl?: string | null;
}): Promise<{ success: boolean; blocId?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('creer_a_la_une', {
    p_titre: params.titre,
    p_description: params.description ?? null,
    p_categorie_id: params.categorieId,
    p_sous_categorie_id: params.sousCategorieId ?? null,
    p_elements: params.elements,
    p_image_url: params.imageUrl ?? null,
  });
  if (error) {
    if (error.message.includes('QUOTA_ATTEINT'))
      return { success: false, error: "Vous avez atteint 10 blocs aujourd'hui." };
    if (error.message.includes('TROP_ELEMENTS'))
      return { success: false, error: 'Maximum 20 éléments par bloc.' };
    return { success: false, error: 'Erreur lors de la création.' };
  }
  return { success: true, blocId: data as string };
};

// ─── Réactiver un ancien bloc ─────────────────────────────────────────────────

export const reactiverBloc = async (
  blocId: string,
): Promise<{ success: boolean; blocId?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('reactiver_a_la_une', { p_bloc_id: blocId });
  if (error) {
    if (error.message.includes('QUOTA_ATTEINT'))
      return { success: false, error: 'Limite de 10 blocs/jour atteinte.' };
    return { success: false, error: 'Réactivation impossible.' };
  }
  return { success: true, blocId: data as string };
};

// ─── Cache mémoire 5 min pour getBlocsActifs ─────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000;
const blocsCache = new Map<string, { data: BlocALaUne[]; ts: number }>();

// ─── Blocs actifs d'une catégorie (clients) ───────────────────────────────────

export const getBlocsActifs = async (
  categorieId: string,
  sousCategorieId?: string,
): Promise<BlocALaUne[]> => {
  const cacheKey = `${categorieId}:${sousCategorieId ?? ''}`;
  const hit = blocsCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  let query = supabase
    .from('a_la_une')
    .select('*')
    .eq('categorie_id', categorieId)
    .eq('actif', true)
    .gt('expire_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(30);

  if (sousCategorieId) {
    query = query.or(`sous_categorie_id.eq.${sousCategorieId},sous_categorie_id.is.null`);
  }

  const { data, error } = await query;
  if (error) return [];
  const blocs = (data ?? []) as BlocALaUne[];

  if (blocs.length === 0) {
    blocsCache.set(cacheKey, { data: [], ts: Date.now() });
    return [];
  }

  // Enrichir avec le nom et le logo de la boutique
  const prestataireIds = [...new Set(blocs.map(b => b.prestataire_id))];
  const { data: shops } = await supabase
    .from('shops')
    .select('merchant_id, name, logo_url')
    .in('merchant_id', prestataireIds);

  const shopMap: Record<string, { name: string; logo_url: string | null }> = {};
  for (const s of shops ?? []) {
    shopMap[s.merchant_id] = { name: s.name, logo_url: s.logo_url ?? null };
  }

  const result = blocs.map(b => ({
    ...b,
    shop_name: shopMap[b.prestataire_id]?.name,
    shop_logo_url: shopMap[b.prestataire_id]?.logo_url ?? null,
  }));
  blocsCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
};

// ─── Tous les blocs actifs (feed client, toutes catégories) ──────────────────

export const getTousLesBlocsActifs = async (): Promise<BlocALaUne[]> => {
  const { data, error } = await supabase
    .from('a_la_une')
    .select('*')
    .eq('actif', true)
    .gt('expire_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  const blocs = data as BlocALaUne[];
  if (blocs.length === 0) return [];

  const prestataireIds = [...new Set(blocs.map(b => b.prestataire_id))];
  const { data: shops } = await supabase
    .from('shops')
    .select('merchant_id, name, logo_url')
    .in('merchant_id', prestataireIds);

  const shopMap: Record<string, { name: string; logo_url: string | null }> = {};
  for (const s of shops ?? []) {
    shopMap[s.merchant_id] = { name: s.name, logo_url: s.logo_url ?? null };
  }

  return blocs.map(b => ({
    ...b,
    shop_name: shopMap[b.prestataire_id]?.name ?? 'Boutique',
    shop_logo_url: shopMap[b.prestataire_id]?.logo_url ?? null,
  }));
};

// ─── Mes blocs (prestataire) : actifs + historique ───────────────────────────

export const getMesBlocs = async (): Promise<{
  actifs: BlocALaUne[];
  historique: BlocALaUne[];
}> => {
  const { data, error } = await supabase
    .from('a_la_une')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { actifs: [], historique: [] };

  const now = Date.now();
  const all = (data ?? []) as BlocALaUne[];
  const actifs = all.filter(b => b.actif && new Date(b.expire_at).getTime() > now);
  const historique = all.filter(b => !b.actif || new Date(b.expire_at).getTime() <= now);
  return { actifs, historique };
};

// ─── Quota du jour ────────────────────────────────────────────────────────────

export const getQuotaDuJour = async (): Promise<{ utilises: number; restants: number }> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('a_la_une')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());
  const utilises = count ?? 0;
  return { utilises, restants: Math.max(0, 10 - utilises) };
};

// ─── Message de partage généré par LASSİ (non modifiable) ────────────────────

/** Message de partage par élément — lien court (lassi.sn/b/code/index). */
export function buildShareMessage(params: {
  elementNom: string;
  elementPrix: number;
  elementIndex: number;
  blocTitre: string;
  blocDescription: string | null;
  shopName: string;
  blocCode: string;
  expireAt: string;
}): string {
  const hoursLeft = Math.max(
    1,
    Math.ceil((new Date(params.expireAt).getTime() - Date.now()) / 3_600_000),
  );
  const prix = params.elementPrix.toLocaleString('fr-FR') + ' F CFA';
  const link = lienElement(params.blocCode, params.elementIndex);
  const lines = [
    `✨ *${params.elementNom}* — ${prix}`,
    `📌 ${params.blocTitre} · ${params.shopName}`,
  ];
  if (params.blocDescription) lines.push('', params.blocDescription);
  lines.push(
    '',
    `⏳ Offre valable encore ${hoursLeft}h`,
    `👉 ${link}`,
    '',
    '─────────────────────',
    'Propulsé par LASSİ 🇸🇳',
  );
  return lines.join('\n');
}
