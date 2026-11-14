// Service Site Builder — charge/sauvegarde la personnalisation vitrine (présentation).
import { supabase } from '../lib/supabase';
import { normalizeSiteConfig, type SiteConfig } from '../config/siteThemes';

// Config actuelle de la boutique (NULL en base ⇒ défaut normalisé).
export async function getSiteConfig(shopId: string): Promise<SiteConfig> {
  const { data, error } = await supabase
    .from('shops')
    .select('site_config')
    .eq('id', shopId)
    .single();
  if (error || !data) return normalizeSiteConfig(null);
  return normalizeSiteConfig((data.site_config as Partial<SiteConfig> | null) ?? null);
}

// Sauvegarde via EF owner-only (schéma blanc serveur).
export async function saveSiteConfig(
  shopId: string,
  cfg: SiteConfig,
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: sessData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const session = sessData?.session ?? null;
  if (!session) return { success: false, error: 'Non connecté.' };

  const { data, error } = await supabase.functions.invoke('save-site-config', {
    body: { shopId, site_config: normalizeSiteConfig(cfg) },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || !data?.success) return { success: false, error: data?.error ?? 'Échec de la sauvegarde.' };
  return { success: true };
}
